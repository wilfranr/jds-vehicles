import { PrismaClient } from '@prisma/client';
import { E2E_BRAND_PREFIX, E2E_EMAIL_DOMAIN, E2E_VEHICLE_COLOR_PREFIX } from './test-data';

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

/**
 * Antes: barre restos de una ejecución interrumpida. Después: barre lo que haya quedado y comprueba que la
 * ejecución completa no deja usuarios, vehículos ni reservas residuales.
 */
export default async function globalSetup() {
  const prisma = new PrismaClient();
  await sweepTemporaryData(prisma);
  const before = await prisma.user.count();
  const vehiclesBefore = await prisma.vehiculo.count();
  const reservationsBefore = await prisma.reserva.count();

  return async () => {
    const leftovers = await prisma.user.count({ where: { email: { endsWith: E2E_EMAIL_DOMAIN } } });
    await sweepTemporaryData(prisma);
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
      leftovers > 0
    ) {
      throw new Error(
        `Las pruebas e2e dejaron datos residuales: usuarios ${before}→${after.users}, vehículos ${vehiclesBefore}→${after.vehicles}, reservas ${reservationsBefore}→${after.reservations}.`
      );
    }
  };
}
