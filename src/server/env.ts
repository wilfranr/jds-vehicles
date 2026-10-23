import { constants } from 'node:fs';
import { access, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { LOG_LEVELS } from './log-level';

/**
 * Definición ÚNICA de las variables de entorno de la aplicación (F5-03). Se valida al arrancar el servidor
 * (`instrumentation.ts`) y falla con un mensaje claro que **nunca imprime valores** (solo el nombre de la variable
 * y la regla incumplida). `.env.example` se comprueba contra `ENV_VARIABLES` en una prueba.
 */

/** Variables que documenta `.env.example` (las del seed y de los scripts de operación se listan aparte). */
export const ENV_VARIABLES = [
  'DB_PORT',
  'DATABASE_URL',
  'AUTH_SECRET',
  'AUTH_TRUST_HOST',
  'TRUST_PROXY',
  'TRUST_PROXY_HOPS',
  'RESERVA_EXPIRACION_HORAS',
  'UPLOADS_DIR',
  'LOG_LEVEL',
  'HEALTH_MIN_FREE_MB',
  'NEXT_PUBLIC_SITE_URL',
  'NEXT_PUBLIC_WHATSAPP_NUMBER',
  'SEED_ADMIN_PASSWORD',
  'SEED_CLIENT_PASSWORD',
] as const;

export { LOG_LEVELS, getLogLevel, type LogLevel } from './log-level';

export const MIN_SECRET_LENGTH = 32;
const WEAK_SECRETS = new Set(['changeme', 'secret', 'password', 'your-secret-here', 'dummy']);

export interface EnvIssue {
  variable: string;
  rule: string;
}

export class EnvError extends Error {
  constructor(readonly issues: EnvIssue[]) {
    super(
      `Configuración de entorno inválida (${issues.length}):\n` +
        issues.map((i) => `  - ${i.variable}: ${i.rule}`).join('\n') +
        '\nRevisa `.env.example` y el checklist de despliegue del README. Los valores no se muestran.'
    );
    this.name = 'EnvError';
  }
}

type Source = Record<string, string | undefined>;

const blank = (value: string | undefined) => (value?.trim() ? value.trim() : undefined);

function isLocalHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

/** Valida el entorno. En producción aplica las reglas estrictas; en desarrollo solo los formatos. */
export function validateEnv(source: Source = process.env): EnvIssue[] {
  const production = source.NODE_ENV === 'production';
  const issues: EnvIssue[] = [];
  const fail = (variable: string, rule: string) => issues.push({ variable, rule });

  // DATABASE_URL: obligatoria, mysql://
  const databaseUrl = blank(source.DATABASE_URL);
  if (!databaseUrl) fail('DATABASE_URL', 'es obligatoria');
  else {
    try {
      const url = new URL(databaseUrl);
      if (url.protocol !== 'mysql:') fail('DATABASE_URL', 'debe empezar por mysql://');
      else if (!url.hostname || url.pathname.length <= 1) {
        fail('DATABASE_URL', 'debe incluir servidor y nombre de la base de datos');
      }
    } catch {
      fail('DATABASE_URL', 'no es una URL válida');
    }
  }

  // AUTH_SECRET (o NEXTAUTH_SECRET): obligatoria en producción, mínimo 32 caracteres y no trivial
  const secret = blank(source.AUTH_SECRET) ?? blank(source.NEXTAUTH_SECRET);
  if (production) {
    if (!secret)
      fail('AUTH_SECRET', 'es obligatoria en producción (genérala con `openssl rand -base64 32`)');
    else if (secret.length < MIN_SECRET_LENGTH) {
      fail('AUTH_SECRET', `debe tener al menos ${MIN_SECRET_LENGTH} caracteres`);
    } else if (WEAK_SECRETS.has(secret.toLowerCase()) || /^(.)\1+$/.test(secret)) {
      fail('AUTH_SECRET', 'es demasiado predecible');
    }
  }

  // Detrás del proxy inverso: confiar en el host y en X-Forwarded-For
  if (production) {
    if (source.AUTH_TRUST_HOST !== 'true') fail('AUTH_TRUST_HOST', 'debe ser `true` en producción');
    if (source.TRUST_PROXY !== 'true') {
      fail(
        'TRUST_PROXY',
        'debe ser `true` en producción (sin ella todos los visitantes comparten el cupo de intentos)'
      );
    }
  }
  const hops = blank(source.TRUST_PROXY_HOPS);
  if (hops !== undefined && !/^[1-9]\d?$/.test(hops)) {
    fail('TRUST_PROXY_HOPS', 'debe ser un entero positivo (p. ej. 1)');
  }

  // Reservas
  const expiry = blank(source.RESERVA_EXPIRACION_HORAS);
  if (expiry !== undefined && expiry !== '0' && !/^[1-9]\d{0,5}$/.test(expiry)) {
    fail(
      'RESERVA_EXPIRACION_HORAS',
      'debe ser un entero positivo de horas, o 0 para que no expiren'
    );
  }

  // Carpeta de subidas: absoluta en producción (la existencia y el permiso de escritura se comprueban aparte)
  const uploads = blank(source.UPLOADS_DIR);
  if (production && !uploads) fail('UPLOADS_DIR', 'es obligatoria en producción');
  else if (production && uploads && !path.isAbsolute(uploads)) {
    fail('UPLOADS_DIR', 'debe ser una ruta absoluta en producción');
  }

  // Registro de eventos y salud
  const level = blank(source.LOG_LEVEL);
  if (level !== undefined && !(LOG_LEVELS as readonly string[]).includes(level)) {
    fail('LOG_LEVEL', `debe ser uno de: ${LOG_LEVELS.join(', ')}`);
  }
  const minFree = blank(source.HEALTH_MIN_FREE_MB);
  if (minFree !== undefined && !/^\d{1,6}$/.test(minFree)) {
    fail('HEALTH_MIN_FREE_MB', 'debe ser un entero de megabytes');
  }

  // URL pública y WhatsApp de respaldo
  const site = blank(source.NEXT_PUBLIC_SITE_URL);
  if (!site) {
    if (production) fail('NEXT_PUBLIC_SITE_URL', 'es obligatoria en producción');
  } else {
    try {
      const url = new URL(site);
      if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLocalHost(url.hostname))) {
        if (production)
          fail('NEXT_PUBLIC_SITE_URL', 'debe ser https en producción (http solo en localhost)');
      }
    } catch {
      fail('NEXT_PUBLIC_SITE_URL', 'no es una URL válida');
    }
  }
  const whatsapp = blank(source.NEXT_PUBLIC_WHATSAPP_NUMBER);
  if (whatsapp !== undefined && !/^\d{10,15}$/.test(whatsapp.replace(/\D/g, ''))) {
    fail('NEXT_PUBLIC_WHATSAPP_NUMBER', 'debe contener entre 10 y 15 dígitos');
  }

  return issues;
}

/** Lanza `EnvError` (sin valores) si el entorno no es válido. No se ejecuta durante `next build`. */
export function assertEnv(source: Source = process.env): void {
  if (source.NEXT_PHASE === 'phase-production-build') return;
  const issues = validateEnv(source);
  if (issues.length > 0) throw new EnvError(issues);
}

/**
 * Comprueba (al arrancar) que la carpeta de subidas existe —se crea si falta— y es escribible. No imprime la ruta.
 * Devuelve el problema o `null`.
 */
export async function checkUploadsWritable(dir: string): Promise<string | null> {
  try {
    await mkdir(dir, { recursive: true, mode: 0o750 });
    await access(dir, constants.R_OK | constants.W_OK);
    return null;
  } catch {
    return 'la carpeta no existe, no se pudo crear o no es escribible por el usuario de la aplicación';
  }
}

/** Como `assertEnv` pero además exige que `UPLOADS_DIR` sea escribible (solo en producción). */
export async function assertRuntimeEnv(source: Source = process.env): Promise<void> {
  if (source.NEXT_PHASE === 'phase-production-build') return;
  const issues = validateEnv(source);
  if (source.NODE_ENV === 'production' && !issues.some((i) => i.variable === 'UPLOADS_DIR')) {
    const problem = await checkUploadsWritable(
      path.resolve(/*turbopackIgnore: true*/ blank(source.UPLOADS_DIR) ?? './uploads')
    );
    if (problem) issues.push({ variable: 'UPLOADS_DIR', rule: problem });
  }
  if (issues.length > 0) throw new EnvError(issues);
}
