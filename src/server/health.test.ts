// @vitest-environment node
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkHealth, DEFAULT_MIN_FREE_MB, minFreeMbFromEnv, type HealthDeps } from './health';

afterEach(() => vi.restoreAllMocks());

function deps(overrides: Partial<HealthDeps> = {}): HealthDeps {
  return {
    pingDb: vi.fn().mockResolvedValue(1),
    uploadsDir: '/ruta/secreta/uploads',
    minFreeMb: 200,
    ensureDir: vi.fn().mockResolvedValue(undefined),
    canWrite: vi.fn().mockResolvedValue(undefined),
    freeBytes: vi.fn().mockResolvedValue(10 * 1024 ** 3),
    ...overrides,
  };
}

describe('checkHealth', () => {
  it('todo sano → ok', async () => {
    expect(await checkHealth(deps())).toEqual({
      status: 'ok',
      db: 'up',
      uploads: 'ok',
      disk: 'ok',
    });
  });

  it('la BD caída → error con db: down, sin filtrar el mensaje del fallo', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const report = await checkHealth(
      deps({
        pingDb: vi
          .fn()
          .mockRejectedValue(new Error("Can't reach database server at `10.0.0.5:3306` user=jds")),
      })
    );
    expect(report).toEqual({ status: 'error', db: 'down', uploads: 'ok', disk: 'ok' });
    const serialized = JSON.stringify(report);
    expect(serialized).not.toMatch(/10\.0\.0\.5|jds|database server/);
  });

  it('carpeta de subidas no escribible → error y disco desconocido', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const report = await checkHealth(
      deps({ canWrite: vi.fn().mockRejectedValue(new Error('EACCES: /ruta/secreta')) })
    );
    expect(report).toEqual({ status: 'error', db: 'up', uploads: 'error', disk: 'unknown' });
    expect(JSON.stringify(report)).not.toContain('secreta');
  });

  it('carpeta imposible de crear → error', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const report = await checkHealth(
      deps({ ensureDir: vi.fn().mockRejectedValue(new Error('ENOENT')) })
    );
    expect(report.status).toBe('error');
    expect(report.uploads).toBe('error');
  });

  it('poco espacio libre → error con disk: low', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const report = await checkHealth(
      deps({ freeBytes: vi.fn().mockResolvedValue(50 * 1024 * 1024) })
    );
    expect(report).toEqual({ status: 'error', db: 'up', uploads: 'ok', disk: 'low' });
  });

  it('no poder medir el espacio no tumba la salud (disk: unknown)', async () => {
    const report = await checkHealth(
      deps({ freeBytes: vi.fn().mockRejectedValue(new Error('x')) })
    );
    expect(report).toEqual({ status: 'ok', db: 'up', uploads: 'ok', disk: 'unknown' });
  });

  it('registra el fallo solo con el nombre del componente', async () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    await checkHealth(
      deps({ pingDb: vi.fn().mockRejectedValue(new Error('clave-secreta-db en host-interno')) })
    );
    const line = String(spy.mock.calls[0]![0]);
    expect(JSON.parse(line)).toMatchObject({
      channel: 'ops',
      level: 'error',
      event: 'health_failed',
      components: ['db'],
    });
    expect(line).not.toMatch(/clave-secreta|host-interno/);
  });

  it('con las comprobaciones reales: carpeta temporal sana y carpeta imposible', async () => {
    const base = await mkdtemp(path.join(os.tmpdir(), 'jds-health-'));
    try {
      const ok = await checkHealth({
        pingDb: async () => 1,
        uploadsDir: path.join(base, 'u'),
        minFreeMb: 1,
      });
      expect(ok).toEqual({ status: 'ok', db: 'up', uploads: 'ok', disk: 'ok' });

      await writeFile(path.join(base, 'archivo'), 'x');
      vi.spyOn(console, 'info').mockImplementation(() => {});
      const bad = await checkHealth({
        pingDb: async () => 1,
        uploadsDir: path.join(base, 'archivo', 'sub'),
        minFreeMb: 1,
      });
      expect(bad.status).toBe('error');
      expect(bad.uploads).toBe('error');
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });
});

describe('minFreeMbFromEnv', () => {
  it('valor por defecto y valores válidos', () => {
    expect(minFreeMbFromEnv({})).toBe(DEFAULT_MIN_FREE_MB);
    expect(minFreeMbFromEnv({ HEALTH_MIN_FREE_MB: '500' })).toBe(500);
    expect(minFreeMbFromEnv({ HEALTH_MIN_FREE_MB: 'abc' })).toBe(DEFAULT_MIN_FREE_MB);
  });
});
