import { mkdir, readdir, rm } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';
import {
  E2E_BRAND_PREFIX,
  E2E_EMAIL_DOMAIN,
  E2E_UPLOADS_DIR,
  E2E_VEHICLE_COLOR_PREFIX,
} from './test-data';

/** Borra los datos temporales de las pruebas (usuarios, vehículos y sus reservas, ventas y fotos). */
async function sweepTemporaryData(prisma: PrismaClient) {
  const users = await prisma.user.findMany({
    where: { email: { endsWith: E2E_EMAIL_DOMAIN } },
    select: { id: true },
  });
  const vehicles = await prisma.vehiculo.findMany({
    where: { color: { startsWith: E2E_VEHICLE_COLOR_PREFIX } },
    select: { id: true },
  });
  const userIds = users.map((u) => u.id);
  const vehicleIds = vehicles.map((v) => v.id);
  // Las ventas apuntan al vehículo y al comprador con `ON DELETE RESTRICT`: van primero.
  await prisma.venta.deleteMany({
    where: { OR: [{ compradorId: { in: userIds } }, { vehiculoId: { in: vehicleIds } }] },
  });
  await prisma.reserva.deleteMany({
    where: { OR: [{ usuarioId: { in: userIds } }, { vehiculoId: { in: vehicleIds } }] },
  });
  await prisma.vehiculo.deleteMany({ where: { id: { in: vehicleIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  // Marcas y modelos de las pruebas del panel (los vehículos que los usan ya se borraron arriba).
  await prisma.modelo.deleteMany({
    where: {
      OR: [
        { nombre: { startsWith: E2E_BRAND_PREFIX } },
        { marca: { nombre: { startsWith: E2E_BRAND_PREFIX } } },
      ],
    },
  });
  await prisma.marca.deleteMany({ where: { nombre: { startsWith: E2E_BRAND_PREFIX } } });
}

interface Marked {
  users: number;
  vehicles: number;
  reservations: number;
  sales: number;
  photos: number;
  brands: number;
  models: number;
}

/** Cuenta los datos temporales (marcados por prefijo) que siguen en la BD: tras las pruebas deben ser CERO. */
async function countMarked(prisma: PrismaClient): Promise<Marked> {
  const users = await prisma.user.findMany({
    where: { email: { endsWith: E2E_EMAIL_DOMAIN } },
    select: { id: true },
  });
  const vehicles = await prisma.vehiculo.findMany({
    where: { color: { startsWith: E2E_VEHICLE_COLOR_PREFIX } },
    select: { id: true },
  });
  const userIds = users.map((u) => u.id);
  const vehicleIds = vehicles.map((v) => v.id);
  const link = (userField: 'usuarioId' | 'compradorId') => ({
    OR: [{ [userField]: { in: userIds } }, { vehiculoId: { in: vehicleIds } }],
  });
  return {
    users: users.length,
    vehicles: vehicles.length,
    reservations: await prisma.reserva.count({ where: link('usuarioId') }),
    sales: await prisma.venta.count({ where: link('compradorId') }),
    photos: await prisma.vehiculoFoto.count({ where: { vehiculoId: { in: vehicleIds } } }),
    brands: await prisma.marca.count({ where: { nombre: { startsWith: E2E_BRAND_PREFIX } } }),
    models: await prisma.modelo.count({
      where: {
        OR: [
          { nombre: { startsWith: E2E_BRAND_PREFIX } },
          { marca: { nombre: { startsWith: E2E_BRAND_PREFIX } } },
        ],
      },
    }),
  };
}

/** Archivos presentes en la carpeta de subidas del servidor de e2e (vacía si no existe). */
async function listUploads(): Promise<string[]> {
  try {
    return await readdir(E2E_UPLOADS_DIR);
  } catch {
    return [];
  }
}

/**
 * Antes: barre restos de una ejecución interrumpida. Después: barre lo que haya quedado y comprueba que la
 * ejecución completa no deja usuarios, vehículos, reservas ni ARCHIVOS de fotos (`UPLOADS_DIR`) residuales.
 */
export default async function globalSetup() {
  const prisma = new PrismaClient();
  await sweepTemporaryData(prisma);
  // Restos de una ejecución interrumpida: la carpeta de subidas de e2e empieza vacía.
  await rm(E2E_UPLOADS_DIR, { recursive: true, force: true });
  await mkdir(E2E_UPLOADS_DIR, { recursive: true });
  const before = await prisma.user.count();
  const vehiclesBefore = await prisma.vehiculo.count();
  const reservationsBefore = await prisma.reserva.count();
  const salesBefore = await prisma.venta.count();
  const photosBefore = await prisma.vehiculoFoto.count();
  const brandsBefore = await prisma.marca.count();
  const modelsBefore = await prisma.modelo.count();

  return async () => {
    const marked = await countMarked(prisma);
    const leftovers = Object.values(marked).reduce((sum, n) => sum + n, 0);
    const leftoverFiles = await listUploads();
    await sweepTemporaryData(prisma);
    await rm(E2E_UPLOADS_DIR, { recursive: true, force: true });
    const after = {
      users: await prisma.user.count(),
      vehicles: await prisma.vehiculo.count(),
      reservations: await prisma.reserva.count(),
      sales: await prisma.venta.count(),
      photos: await prisma.vehiculoFoto.count(),
      brands: await prisma.marca.count(),
      models: await prisma.modelo.count(),
    };
    await prisma.$disconnect();
    if (
      after.users !== before ||
      after.vehicles !== vehiclesBefore ||
      after.reservations !== reservationsBefore ||
      after.sales !== salesBefore ||
      after.photos !== photosBefore ||
      after.brands !== brandsBefore ||
      after.models !== modelsBefore ||
      leftovers > 0 ||
      leftoverFiles.length > 0
    ) {
      throw new Error(
        `Las pruebas e2e dejaron datos residuales (marcados: ${JSON.stringify(marked)}): usuarios ${before}→${after.users}, vehículos ${vehiclesBefore}→${after.vehicles}, reservas ${reservationsBefore}→${after.reservations}, ventas ${salesBefore}→${after.sales}, fotos ${photosBefore}→${after.photos}, marcas ${brandsBefore}→${after.brands}, modelos ${modelsBefore}→${after.models}, archivos en UPLOADS_DIR: ${leftoverFiles.length}.`
      );
    }
  };
}
