import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Combustible, Condicion, Disponibilidad, Prisma, Transmision } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getFeaturedVehicles, getSimilarVehicles } from './queries';

// Portada (destacados) y «vehículos similares» de la ficha: nunca deben exponer vendidos ni ocultos.
const COLOR = '__test_vistas_f505__';
const created: Record<string, number> = {};

async function make(
  key: string,
  data: { disponibilidad: Disponibilidad; visible: boolean; precio: number }
) {
  const modelo = await prisma.modelo.findFirstOrThrow({
    where: { activo: true },
    include: { marca: true },
  });
  const v = await prisma.vehiculo.create({
    data: {
      modeloId: modelo.id,
      anio: 2023,
      color: COLOR,
      condicion: Condicion.NUEVO,
      precio: new Prisma.Decimal(data.precio),
      kilometraje: 0,
      transmision: Transmision.AUTOMATICA,
      combustible: Combustible.GASOLINA,
      disponibilidad: data.disponibilidad,
      visibleCatalogo: data.visible,
    },
  });
  created[key] = v.id;
  return { id: v.id, marcaId: modelo.marcaId };
}

let base: { id: number; marcaId: number };

beforeAll(async () => {
  base = await make('base', {
    disponibilidad: Disponibilidad.DISPONIBLE,
    visible: true,
    precio: 90_000_000,
  });
  await make('hermano', {
    disponibilidad: Disponibilidad.DISPONIBLE,
    visible: true,
    precio: 91_000_000,
  });
  await make('reservado', {
    disponibilidad: Disponibilidad.RESERVADO,
    visible: true,
    precio: 92_000_000,
  });
  await make('vendido', {
    disponibilidad: Disponibilidad.VENDIDO,
    visible: true,
    precio: 90_500_000,
  });
  await make('oculto', {
    disponibilidad: Disponibilidad.DISPONIBLE,
    visible: false,
    precio: 90_600_000,
  });
});

afterAll(async () => {
  await prisma.vehiculo.deleteMany({ where: { id: { in: Object.values(created) } } });
});

describe('getFeaturedVehicles', () => {
  it('solo trae DISPONIBLES visibles, serializables y como máximo `limit`', async () => {
    const featured = await getFeaturedVehicles(50);
    const mine = featured.filter((v) => v.color === COLOR).map((v) => v.id);
    expect(mine).toEqual(expect.arrayContaining([created.base, created.hermano]));
    expect(mine).not.toContain(created.reservado);
    expect(mine).not.toContain(created.vendido);
    expect(mine).not.toContain(created.oculto);
    expect(featured.every((v) => v.disponibilidad === Disponibilidad.DISPONIBLE)).toBe(true);
    expect(() => JSON.stringify(featured)).not.toThrow();
    expect(typeof featured[0]!.precio).toBe('number');
    expect(await getFeaturedVehicles(1)).toHaveLength(1);
  });
});

describe('getSimilarVehicles', () => {
  it('excluye el propio vehículo, los vendidos y los ocultos y no pasa de 3', async () => {
    const similar = await getSimilarVehicles({
      id: base.id,
      marcaId: base.marcaId,
      precio: 90_000_000,
    });
    const ids = similar.map((v) => v.id);
    expect(similar.length).toBeLessThanOrEqual(3);
    expect(ids).not.toContain(base.id);
    expect(ids).not.toContain(created.vendido);
    expect(ids).not.toContain(created.oculto);
    expect(similar.every((v) => v.disponibilidad !== Disponibilidad.VENDIDO)).toBe(true);
  });

  it('con una marca y un rango de precio sin coincidencias devuelve una lista vacía', async () => {
    const none = await getSimilarVehicles({ id: 1, marcaId: 4294967295, precio: 1 });
    expect(none).toEqual([]);
  });
});
