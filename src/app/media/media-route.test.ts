// @vitest-environment node
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { saveImagePair } from '@/server/media/storage';
import { GET } from './[...ruta]/route';

let dir: string;
let id: string;
const previous = process.env.UPLOADS_DIR;

beforeAll(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'jds-route-'));
  process.env.UPLOADS_DIR = dir;
  id = (await saveImagePair(dir, { main: Buffer.from('IMAGEN'), thumb: Buffer.from('MINI') })).id;
  // Un archivo «secreto» junto a la carpeta, que no debe poder alcanzarse nunca.
});
afterAll(async () => {
  if (previous === undefined) delete process.env.UPLOADS_DIR;
  else process.env.UPLOADS_DIR = previous;
  await rm(dir, { recursive: true, force: true });
});

const call = (ruta: string[]) =>
  GET(new Request('http://localhost/media'), { params: Promise.resolve({ ruta }) });

describe('GET /media/[...ruta]', () => {
  it('sirve la imagen y la miniatura con tipo fijo, nosniff y caché inmutable', async () => {
    const response = await call([`${id}.webp`]);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('IMAGEN');
    expect(response.headers.get('Content-Type')).toBe('image/webp');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('Cache-Control')).toContain('immutable');
    expect(response.headers.get('Content-Security-Policy')).toContain("default-src 'none'");

    expect(await (await call([`${id}_t.webp`])).text()).toBe('MINI');
  });

  it.each([
    [['..', '..', '.env']],
    [['../../.env']],
    [['..%2F..%2F.env']],
    [['%2e%2e%2f%2e%2e%2f.env']],
    [['..\\..\\.env']],
    [[`../${'3f2b8c1e-9d4a-4b7e-8a61-0c5d2e7f9a10'}.webp`]],
    [['.env']],
    [['.']],
    [['..']],
    [[]],
    [['a', 'b']],
    [['3f2b8c1e-9d4a-4b7e-8a61-0c5d2e7f9a10.webp']], // nombre válido pero inexistente
    [['3f2b8c1e-9d4a-4b7e-8a61-0c5d2e7f9a10.webp\0.png']],
    [['/etc/passwd']],
    [['C:\\Windows\\win.ini']],
  ])('responde 404 para %j', async (ruta) => {
    const response = await call(ruta as string[]);
    expect(response.status).toBe(404);
    expect(response.headers.get('Content-Type')).toContain('text/plain');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(await response.text()).toBe('Not found');
  });

  it('un nombre con segmentos extra no se sirve aunque el primero sea válido', async () => {
    expect((await call([`${id}.webp`, 'extra'])).status).toBe(404);
  });
});
