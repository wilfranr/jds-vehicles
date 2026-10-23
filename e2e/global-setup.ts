import { mkdir, readdir, rm } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';
import {
  E2E_BRAND_PREFIX,
  E2E_EMAIL_DOMAIN,
  E2E_UPLOADS_DIR,
  E2E_VEHICLE_COLOR_PREFIX,
} from './test-data';

/** Borra los datos temporales de las pruebas de reservas (usuarios, vehículos y sus reservas). */
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

  return async () => {
    const leftovers = await prisma.user.count({ where: { email: { endsWith: E2E_EMAIL_DOMAIN } } });
    const leftoverFiles = await listUploads();
    await sweepTemporaryData(prisma);
    await rm(E2E_UPLOADS_DIR, { recursive: true, force: true });
    const after = {
      users: await prisma.user.count(),
      vehicles: await prisma.vehiculo.count(),
      reservations: await prisma.reserva.count(),
    };
    await prisma.$disconnect();
    if (
      after.users !== before ||
      after.vehicles !== vehiclesBefore ||
      after.reservations !== reservationsBefore ||
      leftovers > 0 ||
      leftoverFiles.length > 0
    ) {
      throw new Error(
        `Las pruebas e2e dejaron datos residuales: usuarios ${before}→${after.users}, vehículos ${vehiclesBefore}→${after.vehicles}, reservas ${reservationsBefore}→${after.reservations}, archivos en UPLOADS_DIR: ${leftoverFiles.length}.`
      );
    }
  };
}
