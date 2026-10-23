import 'server-only';

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';

export interface BrandWithModels {
  id: number;
  nombre: string;
  activo: boolean;
  vehicleCount: number;
  modelos: { id: number; nombre: string; activo: boolean; vehicleCount: number }[];
}

export type CatalogWriteResult =
  { status: 'ok'; id: number } | { status: 'duplicate' } | { status: 'not_found' };

function isUnique(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

export async function listBrandsWithModels(): Promise<BrandWithModels[]> {
  const brands = await prisma.marca.findMany({
    orderBy: { nombre: 'asc' },
    include: {
      modelos: {
        orderBy: { nombre: 'asc' },
        include: { _count: { select: { vehiculos: true } } },
      },
    },
  });
  return brands.map((b) => ({
    id: b.id,
    nombre: b.nombre,
    activo: b.activo,
    vehicleCount: b.modelos.reduce((sum, m) => sum + m._count.vehiculos, 0),
    modelos: b.modelos.map((m) => ({
      id: m.id,
      nombre: m.nombre,
      activo: m.activo,
      vehicleCount: m._count.vehiculos,
    })),
  }));
}

/** Los nombres son únicos (marca global; modelo dentro de su marca): un duplicado es un error de campo, no un 500. */
async function guarded(fn: () => Promise<number>): Promise<CatalogWriteResult> {
  try {
    return { status: 'ok', id: await fn() };
  } catch (error) {
    if (isUnique(error)) return { status: 'duplicate' };
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return { status: 'not_found' };
    }
    throw error;
  }
}

export const createBrand = (nombre: string) =>
  guarded(async () => (await prisma.marca.create({ data: { nombre }, select: { id: true } })).id);

export const renameBrand = (id: number, nombre: string) =>
  guarded(async () => (await prisma.marca.update({ where: { id }, data: { nombre } })).id);

export const setBrandActive = (id: number, activo: boolean) =>
  guarded(async () => (await prisma.marca.update({ where: { id }, data: { activo } })).id);

export async function createModel(marcaId: number, nombre: string): Promise<CatalogWriteResult> {
  const brand = await prisma.marca.findUnique({ where: { id: marcaId }, select: { id: true } });
  if (!brand) return { status: 'not_found' };
  return guarded(
    async () => (await prisma.modelo.create({ data: { marcaId, nombre }, select: { id: true } })).id
  );
}

export const renameModel = (id: number, nombre: string) =>
  guarded(async () => (await prisma.modelo.update({ where: { id }, data: { nombre } })).id);

export const setModelActive = (id: number, activo: boolean) =>
  guarded(async () => (await prisma.modelo.update({ where: { id }, data: { activo } })).id);
