// @vitest-environment node
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const queryRaw = vi.fn();
vi.mock('@/lib/db', () => ({ prisma: { $queryRaw: (...a: unknown[]) => queryRaw(...a) } }));

import { GET as live } from './live/route';
import { GET as health } from './route';

let base: string;
const previous = process.env.UPLOADS_DIR;

beforeAll(async () => {
  base = await mkdtemp(path.join(os.tmpdir(), 'jds-health-route-'));
});
afterAll(async () => {
  if (previous === undefined) delete process.env.UPLOADS_DIR;
  else process.env.UPLOADS_DIR = previous;
  await rm(base, { recursive: true, force: true });
});
beforeEach(() => {
  queryRaw.mockReset().mockResolvedValue([{ 1: 1 }]);
  process.env.UPLOADS_DIR = path.join(base, 'ok');
  vi.spyOn(console, 'info').mockImplementation(() => {});
});

describe('GET /api/health', () => {
  it('200 con todo sano, JSON mínimo y sin caché', async () => {
    const response = await health();
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toEqual({ status: 'ok', db: 'up', uploads: 'ok', disk: 'ok' });
  });

  it('503 si la BD falla, sin filtrar el motivo', async () => {
    queryRaw.mockRejectedValue(
      new Error("Can't reach database server at `db.interna:3306` (usuario jds)")
    );
    const response = await health();
    expect(response.status).toBe(503);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    const text = JSON.stringify(await response.json());
    expect(JSON.parse(text)).toMatchObject({ status: 'error', db: 'down' });
    expect(text).not.toMatch(/db\.interna|jds|reach|3306/);
  });

  it('503 si la carpeta de subidas no es utilizable, sin filtrar la ruta', async () => {
    const file = path.join(base, 'archivo');
    await writeFile(file, 'x');
    process.env.UPLOADS_DIR = path.join(file, 'subidas'); // un archivo como carpeta padre: imposible
    const response = await health();
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body).toMatchObject({ status: 'error', db: 'up', uploads: 'error' });
    expect(JSON.stringify(body)).not.toContain('archivo');
  });

  it('503 con poco espacio libre', async () => {
    process.env.HEALTH_MIN_FREE_MB = '999999999'.slice(0, 6); // 999999 MB: más de lo que tiene cualquier disco de prueba
    try {
      const response = await health();
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({ disk: 'low' });
    } finally {
      delete process.env.HEALTH_MIN_FREE_MB;
    }
  });

  it('el informe solo contiene los cuatro campos (nada de versiones ni rutas)', async () => {
    expect(Object.keys(await (await health()).json()).sort()).toEqual([
      'db',
      'disk',
      'status',
      'uploads',
    ]);
  });
});

describe('GET /api/health/live', () => {
  it('confirma que el proceso responde sin tocar la BD ni el disco', async () => {
    queryRaw.mockRejectedValue(new Error('BD caída'));
    process.env.UPLOADS_DIR = '/no/existe/ni/se/puede/crear';
    const response = live();
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toEqual({ status: 'ok' });
    expect(queryRaw).not.toHaveBeenCalled();
  });
});
