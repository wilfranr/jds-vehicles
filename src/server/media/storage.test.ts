// @vitest-environment node
import { mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  deleteImagePair,
  getUploadsDir,
  MEDIA_FILE_PATTERN,
  mediaUrl,
  readMedia,
  resolveMediaPath,
  saveImagePair,
} from './storage';

const ID = '3f2b8c1e-9d4a-4b7e-8a61-0c5d2e7f9a10';
let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'jds-media-'));
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('getUploadsDir', () => {
  it('por defecto ./uploads (absoluta); UPLOADS_DIR la cambia', () => {
    expect(getUploadsDir({})).toBe(path.resolve('./uploads'));
    expect(getUploadsDir({ UPLOADS_DIR: '   ' })).toBe(path.resolve('./uploads'));
    expect(getUploadsDir({ UPLOADS_DIR: '/var/jds/uploads' })).toBe('/var/jds/uploads');
  });
});

describe('resolveMediaPath / patrón de nombres', () => {
  it('acepta solo <uuid v4>.webp y <uuid>_t.webp dentro de la carpeta', () => {
    expect(resolveMediaPath(dir, `${ID}.webp`)).toBe(path.join(dir, `${ID}.webp`));
    expect(resolveMediaPath(dir, `${ID}_t.webp`)).toBe(path.join(dir, `${ID}_t.webp`));
  });

  it.each([
    '../.env',
    '..%2F..%2F.env',
    '..\\..\\.env',
    `../${ID}.webp`,
    `${ID}.webp/../../.env`,
    `/etc/passwd`,
    `${ID}.WEBP`,
    `${ID.toUpperCase()}.webp`,
    `${ID}.jpg`,
    `${ID}.webp\0.png`,
    `${ID}.webp `,
    ` ${ID}.webp`,
    `${ID}_x.webp`,
    `${ID}__t.webp`,
    'foto.webp',
    '.env',
    '',
    '.',
    '..',
    `%2e%2e%2f${ID}.webp`,
    `${ID}.webp%00.png`,
    `${ID}.webp\n`,
    '3f2b8c1e-9d4a-1b7e-8a61-0c5d2e7f9a10.webp', // no es v4
  ])('rechaza %j', (name) => {
    expect(MEDIA_FILE_PATTERN.test(name)).toBe(false);
    expect(resolveMediaPath(dir, name)).toBeNull();
  });
});

describe('guardar, leer y borrar', () => {
  it('guarda con un nombre generado (UUID v4), nunca derivado del original, y no sobrescribe', async () => {
    const a = await saveImagePair(dir, { main: Buffer.from('uno'), thumb: Buffer.from('t1') });
    const b = await saveImagePair(dir, { main: Buffer.from('dos'), thumb: Buffer.from('t2') });

    expect(a.id).not.toBe(b.id);
    expect(MEDIA_FILE_PATTERN.test(`${a.id}.webp`)).toBe(true);
    expect(a.url).toBe(mediaUrl(a.id));
    expect((await readMedia(dir, `${a.id}.webp`))?.toString()).toBe('uno');
    expect((await readMedia(dir, `${a.id}_t.webp`))?.toString()).toBe('t1');
    // permisos: solo propietario y grupo, sin acceso a otros
    expect((await stat(path.join(dir, `${a.id}.webp`))).mode & 0o007).toBe(0);
  });

  it('readMedia devuelve null para nombres inválidos o inexistentes (sin tocar fuera de la carpeta)', async () => {
    expect(await readMedia(dir, '../.env')).toBeNull();
    expect(await readMedia(dir, `${ID}.webp`)).toBeNull();
  });

  it('deleteImagePair borra los dos archivos y solo para URLs generadas por el panel', async () => {
    const saved = await saveImagePair(dir, { main: Buffer.from('x'), thumb: Buffer.from('y') });
    await deleteImagePair(dir, 'https://images.unsplash.com/photo-1'); // externa: no hace nada
    await deleteImagePair(dir, '/media/../../../etc/passwd'); // inválida: no hace nada
    expect(await readMedia(dir, `${saved.id}.webp`)).not.toBeNull();

    await deleteImagePair(dir, saved.url);
    expect(await readMedia(dir, `${saved.id}.webp`)).toBeNull();
    expect(await readMedia(dir, `${saved.id}_t.webp`)).toBeNull();
    await deleteImagePair(dir, saved.url); // idempotente
  });

  it('la carpeta no contiene nada que no sea de la prueba al final', async () => {
    const leftovers = (await readdir(dir)).filter((f) => !MEDIA_FILE_PATTERN.test(f));
    expect(leftovers).toEqual([]);
  });
});
