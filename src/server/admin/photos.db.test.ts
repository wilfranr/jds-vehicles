// @vitest-environment node
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { Condicion } from '@prisma/client';
import { prisma } from '@/lib/db';
import { MAX_PHOTOS_PER_VEHICLE } from '@/server/media/limits';
import {
  addPhotos,
  countVehiclePhotos,
  deletePhoto,
  listVehiclePhotos,
  movePhoto,
  setPrincipalPhoto,
} from './photos';

// BD sembrada; vehículos temporales con color `TMPF404-…` borrados siempre (las fotos caen por cascada).
const TAG = 'TMPF404';
let dbUp = false;
try {
  await prisma.$queryRaw`SELECT 1`;
  dbUp = true;
} catch {
  if (process.env.CI) throw new Error('Las pruebas del panel necesitan la BD en CI.');
}

let counter = 0;
async function makeVehicle() {
  return (
    await prisma.vehiculo.create({
      data: {
        modeloId: 1,
        anio: 2024,
        color: `${TAG}-${++counter}`,
        condicion: Condicion.NUEVO,
        precio: 1000000,
      },
    })
  ).id;
}

const url = (n: number) => `/media/aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12, '0')}.webp`;
const urls = (from: number, count: number) =>
  Array.from({ length: count }, (_, i) => url(from + i));
const orderOf = async (id: number) => (await listVehiclePhotos(id)).map((p) => p.url);
const principals = async (id: number) =>
  (await listVehiclePhotos(id)).filter((p) => p.esPrincipal).length;

async function cleanup() {
  await prisma.vehiculo.deleteMany({ where: { color: { startsWith: TAG } } });
}

describe.skipIf(!dbUp)('fotos de vehículos (BD)', () => {
  afterEach(cleanup);
  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it('la primera foto queda como principal y el orden es consecutivo; las siguientes no son principales', async () => {
    const id = await makeVehicle();
    expect(await addPhotos(id, urls(1, 3))).toMatchObject({ status: 'ok' });

    const photos = await listVehiclePhotos(id);
    expect(photos.map((p) => p.orden)).toEqual([1, 2, 3]);
    expect(photos.map((p) => p.esPrincipal)).toEqual([true, false, false]);

    await addPhotos(id, urls(10, 2));
    expect((await listVehiclePhotos(id)).map((p) => p.orden)).toEqual([1, 2, 3, 4, 5]);
    expect(await principals(id)).toBe(1);
  });

  it(`tope de ${MAX_PHOTOS_PER_VEHICLE} fotos por vehículo (también con la fila bloqueada)`, async () => {
    const id = await makeVehicle();
    expect(await addPhotos(id, urls(1, MAX_PHOTOS_PER_VEHICLE))).toMatchObject({ status: 'ok' });
    expect(await addPhotos(id, urls(100, 1))).toEqual({ status: 'limit' });
    expect(await countVehiclePhotos(id)).toBe(MAX_PHOTOS_PER_VEHICLE);
  });

  it('dos subidas simultáneas no superan el tope', async () => {
    const id = await makeVehicle();
    await addPhotos(id, urls(1, MAX_PHOTOS_PER_VEHICLE - 5));
    const results = await Promise.all([addPhotos(id, urls(100, 4)), addPhotos(id, urls(200, 4))]);
    expect(results.map((r) => r.status).sort()).toEqual(['limit', 'ok']);
    expect(await countVehiclePhotos(id)).toBe(MAX_PHOTOS_PER_VEHICLE - 1);
  });

  it('vehículo inexistente → not_found', async () => {
    expect(await addPhotos(4_000_000_000, urls(1, 1))).toEqual({ status: 'not_found' });
    expect(await countVehiclePhotos(4_000_000_000)).toBeNull();
  });

  it('marcar principal deja EXACTAMENTE una', async () => {
    const id = await makeVehicle();
    await addPhotos(id, urls(1, 3));
    const second = (await listVehiclePhotos(id))[1]!;

    expect(await setPrincipalPhoto(id, second.id)).toEqual({ status: 'ok' });
    const after = await listVehiclePhotos(id);
    expect(after.filter((p) => p.esPrincipal).map((p) => p.id)).toEqual([second.id]);
    // repetir es idempotente
    await setPrincipalPhoto(id, second.id);
    expect(await principals(id)).toBe(1);
  });

  it('subir y bajar intercambia vecinas; en los extremos no cambia nada', async () => {
    const id = await makeVehicle();
    await addPhotos(id, urls(1, 3));
    const [a, b, c] = await listVehiclePhotos(id);

    await movePhoto(id, c!.id, 'up');
    expect(await orderOf(id)).toEqual([a!.url, c!.url, b!.url]);
    await movePhoto(id, a!.id, 'down');
    expect(await orderOf(id)).toEqual([c!.url, a!.url, b!.url]);

    const before = await orderOf(id);
    await movePhoto(id, (await listVehiclePhotos(id))[0]!.id, 'up'); // primera, subir
    await movePhoto(id, (await listVehiclePhotos(id))[2]!.id, 'down'); // última, bajar
    expect(await orderOf(id)).toEqual(before);
    expect((await listVehiclePhotos(id)).map((p) => p.orden)).toEqual([1, 2, 3]);
  });

  it('eliminar la principal promueve la siguiente y renumera; devuelve la URL para borrar el archivo', async () => {
    const id = await makeVehicle();
    await addPhotos(id, urls(1, 3));
    const [first, second] = await listVehiclePhotos(id);

    expect(await deletePhoto(id, first!.id)).toEqual({ status: 'ok', url: first!.url });
    const after = await listVehiclePhotos(id);
    expect(after.map((p) => p.orden)).toEqual([1, 2]);
    expect(after[0]).toMatchObject({ id: second!.id, esPrincipal: true });
    expect(await principals(id)).toBe(1);
  });

  it('eliminar una no principal no cambia la principal; eliminar la última deja el vehículo sin fotos', async () => {
    const id = await makeVehicle();
    await addPhotos(id, urls(1, 2));
    const [first, second] = await listVehiclePhotos(id);

    await deletePhoto(id, second!.id);
    expect((await listVehiclePhotos(id))[0]).toMatchObject({ id: first!.id, esPrincipal: true });
    await deletePhoto(id, first!.id);
    expect(await listVehiclePhotos(id)).toEqual([]);
  });

  it('una foto de otro vehículo no se puede tocar con el id de este (propiedad)', async () => {
    const mine = await makeVehicle();
    const other = await makeVehicle();
    await addPhotos(mine, urls(1, 1));
    await addPhotos(other, urls(50, 2));
    const foreign = (await listVehiclePhotos(other))[1]!;

    expect(await setPrincipalPhoto(mine, foreign.id)).toEqual({ status: 'not_found' });
    expect(await movePhoto(mine, foreign.id, 'up')).toEqual({ status: 'not_found' });
    expect(await deletePhoto(mine, foreign.id)).toEqual({ status: 'not_found' });
    expect(await listVehiclePhotos(other)).toHaveLength(2);
  });
});
