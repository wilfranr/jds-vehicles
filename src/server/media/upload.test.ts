// @vitest-environment node
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_FILE_BYTES, MAX_FILES_PER_UPLOAD, MAX_PHOTOS_PER_VEHICLE } from './limits';
import { uploadVehiclePhotos, type IncomingFile, type UploadDeps } from './upload';

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'jds-upload-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const png = () =>
  sharp({ create: { width: 64, height: 48, channels: 3, background: '#336699' } })
    .png()
    .toBuffer();

async function good(): Promise<IncomingFile> {
  const buffer = await png();
  return { size: buffer.length, read: async () => buffer };
}
const text = (content: string): IncomingFile => ({
  size: content.length,
  read: async () => Buffer.from(content),
});
const files = async () => (await readdir(dir)).sort();

function deps(overrides: Partial<UploadDeps> = {}): UploadDeps {
  return {
    uploadsDir: dir,
    countExisting: vi.fn().mockResolvedValue(0),
    insert: vi.fn().mockImplementation(async (_id: number, urls: string[]) => ({
      status: 'ok' as const,
      ids: urls.map((_, i) => i + 1),
    })),
    ...overrides,
  };
}

describe('uploadVehiclePhotos', () => {
  it('éxito: guarda cada foto y su miniatura con nombres generados e inserta las filas', async () => {
    const d = deps();
    const result = await uploadVehiclePhotos(7, [await good(), await good(), await good()], d);

    expect(result).toEqual({ status: 'ok', count: 3, ids: [1, 2, 3] });
    const urls = vi.mocked(d.insert).mock.calls[0]![1];
    expect(urls).toHaveLength(3);
    for (const url of urls) expect(url).toMatch(/^\/media\/[0-9a-f-]{36}\.webp$/);
    expect(await files()).toHaveLength(6); // 3 imágenes + 3 miniaturas
  });

  it('sin archivos → none', async () => {
    expect(await uploadVehiclePhotos(7, [], deps())).toEqual({ status: 'error', code: 'none' });
  });

  it(`más de ${MAX_FILES_PER_UPLOAD} archivos por envío → tooManyFiles (no se procesa ninguno)`, async () => {
    const many = await Promise.all(Array.from({ length: MAX_FILES_PER_UPLOAD + 1 }, good));
    const d = deps();
    expect(await uploadVehiclePhotos(7, many, d)).toEqual({
      status: 'error',
      code: 'tooManyFiles',
    });
    expect(await files()).toEqual([]);
    expect(d.insert).not.toHaveBeenCalled();
  });

  it('un archivo mayor de 5 MB → tooLarge con su posición, sin leerlo ni guardar nada', async () => {
    const big: IncomingFile = { size: MAX_FILE_BYTES + 1, read: vi.fn() };
    const d = deps();
    expect(await uploadVehiclePhotos(7, [await good(), big], d)).toEqual({
      status: 'error',
      code: 'tooLarge',
      index: 2,
    });
    expect(big.read).not.toHaveBeenCalled();
    expect(await files()).toEqual([]);
  });

  it('exactamente 5 MB sí se acepta en tamaño (el límite es estricto «mayor que»)', async () => {
    const buffer = await png();
    const edge: IncomingFile = { size: MAX_FILE_BYTES, read: async () => buffer };
    expect((await uploadVehiclePhotos(7, [edge], deps())).status).toBe('ok');
  });

  it('un archivo que no es imagen (aunque se llame .jpg) → notImage y no se guarda NADA (todo o nada)', async () => {
    const d = deps();
    const result = await uploadVehiclePhotos(7, [await good(), text('<?php evil(); ?>')], d);
    expect(result).toEqual({ status: 'error', code: 'notImage', index: 2 });
    expect(await files()).toEqual([]);
    expect(d.insert).not.toHaveBeenCalled();
  });

  it('un archivo dañado → corrupt', async () => {
    const valid = await png();
    const truncated: IncomingFile = { size: 100, read: async () => valid.subarray(0, 100) };
    expect(await uploadVehiclePhotos(7, [truncated], deps())).toEqual({
      status: 'error',
      code: 'corrupt',
      index: 1,
    });
  });

  it(`respeta el tope de ${MAX_PHOTOS_PER_VEHICLE} fotos por vehículo`, async () => {
    const d = deps({ countExisting: vi.fn().mockResolvedValue(MAX_PHOTOS_PER_VEHICLE - 1) });
    expect(await uploadVehiclePhotos(7, [await good(), await good()], d)).toEqual({
      status: 'error',
      code: 'limit',
    });
    expect(await files()).toEqual([]);
    const ok = deps({ countExisting: vi.fn().mockResolvedValue(MAX_PHOTOS_PER_VEHICLE - 1) });
    expect((await uploadVehiclePhotos(7, [await good()], ok)).status).toBe('ok');
  });

  it('vehículo inexistente → notFound', async () => {
    const d = deps({ countExisting: vi.fn().mockResolvedValue(null) });
    expect(await uploadVehiclePhotos(7, [await good()], d)).toEqual({
      status: 'error',
      code: 'notFound',
    });
    expect(await files()).toEqual([]);
  });

  it('si la inserción rechaza (tope por carrera), se borran los archivos recién escritos', async () => {
    const d = deps({ insert: vi.fn().mockResolvedValue({ status: 'limit' }) });
    expect(await uploadVehiclePhotos(7, [await good(), await good()], d)).toEqual({
      status: 'error',
      code: 'limit',
    });
    expect(await files()).toEqual([]);
  });

  it('si la inserción lanza, también se limpian los archivos y el error se propaga', async () => {
    const d = deps({ insert: vi.fn().mockRejectedValue(new Error('BD caída')) });
    await expect(uploadVehiclePhotos(7, [await good()], d)).rejects.toThrow('BD caída');
    expect(await files()).toEqual([]);
  });

  it('los nombres nunca derivan del archivo original', async () => {
    const original: IncomingFile & { name: string } = {
      ...(await good()),
      name: '../../evil.php.jpg',
    };
    const d = deps();
    await uploadVehiclePhotos(7, [original], d);
    const urls = vi.mocked(d.insert).mock.calls[0]![1];
    expect(urls[0]).not.toMatch(/evil|php|\.\./);
    expect((await files()).every((f) => /^[0-9a-f-]{36}(_t)?\.webp$/.test(f))).toBe(true);
  });
});
