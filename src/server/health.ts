import { constants } from 'node:fs';
import { access, mkdir, statfs } from 'node:fs/promises';
import { logEvent } from './log';

/** Espacio libre mínimo (MB) en la carpeta de subidas para considerarla sana si `HEALTH_MIN_FREE_MB` no se define. */
export const DEFAULT_MIN_FREE_MB = 200;

export interface HealthReport {
  status: 'ok' | 'error';
  db: 'up' | 'down';
  uploads: 'ok' | 'error';
  disk: 'ok' | 'low' | 'unknown';
}

export interface HealthDeps {
  /** Consulta ligera a la BD; lanza si no responde. */
  pingDb: () => Promise<unknown>;
  uploadsDir: string;
  minFreeMb: number;
  /** Inyectables para pruebas. */
  ensureDir?: (dir: string) => Promise<void>;
  canWrite?: (dir: string) => Promise<void>;
  freeBytes?: (dir: string) => Promise<number>;
}

const defaultEnsureDir = async (dir: string) =>
  void (await mkdir(dir, { recursive: true, mode: 0o750 }));
const defaultCanWrite = (dir: string) => access(dir, constants.R_OK | constants.W_OK);
const defaultFreeBytes = async (dir: string) => {
  const stats = await statfs(dir);
  return Number(stats.bavail) * Number(stats.bsize);
};

/**
 * Estado de salud de la aplicación: BD (consulta ligera), carpeta de subidas escribible y espacio libre aproximado.
 * El informe es mínimo A PROPÓSITO (sin versiones, rutas ni mensajes de error internos); el detalle de un fallo
 * solo va al registro de eventos y únicamente con el nombre del componente.
 */
export async function checkHealth(deps: HealthDeps): Promise<HealthReport> {
  const report: HealthReport = { status: 'ok', db: 'up', uploads: 'ok', disk: 'ok' };
  const failed: string[] = [];

  try {
    await deps.pingDb();
  } catch {
    report.db = 'down';
    failed.push('db');
  }

  try {
    await (deps.ensureDir ?? defaultEnsureDir)(deps.uploadsDir);
    await (deps.canWrite ?? defaultCanWrite)(deps.uploadsDir);
  } catch {
    report.uploads = 'error';
    failed.push('uploads');
  }

  if (report.uploads === 'ok') {
    try {
      const free = await (deps.freeBytes ?? defaultFreeBytes)(deps.uploadsDir);
      if (free < deps.minFreeMb * 1024 * 1024) {
        report.disk = 'low';
        failed.push('disk');
      }
    } catch {
      report.disk = 'unknown';
    }
  } else {
    report.disk = 'unknown';
  }

  if (failed.length > 0) {
    report.status = 'error';
    logEvent({ channel: 'ops', level: 'error', event: 'health_failed', components: failed });
  }
  return report;
}

export function minFreeMbFromEnv(env: Record<string, string | undefined> = process.env): number {
  const raw = env.HEALTH_MIN_FREE_MB?.trim();
  return raw && /^\d{1,6}$/.test(raw) ? Number(raw) : DEFAULT_MIN_FREE_MB;
}
