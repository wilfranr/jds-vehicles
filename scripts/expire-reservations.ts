/**
 * Aplica la expiración de reservas (F3-04). Pensado para el `cron` del servidor (Fase 6):
 *   pnpm reservas:expirar
 * Imprime una línea JSON `{ "expiradas": n, "vehiculosLiberados": m }` y sale con código 1 si falla.
 *
 * Corre fuera del servidor web: no puede invalidar la caché de Next (ver README). Por eso el catálogo se
 * pone al día cuando vencen las consultas cacheadas (portada y filtros ~60 s); el listado y la ficha leen la BD
 * en cada visita.
 */
import { PrismaClient } from '@prisma/client';
import { parseReservationExpirationHours } from '../src/server/reservations/config';
import { expireReservations } from '../src/server/reservations/expire';

async function main() {
  // Con `RESERVA_EXPIRACION_HORAS=0` la expiración está desactivada: no se toca nada.
  if (parseReservationExpirationHours() === null) {
    console.log(JSON.stringify({ expiradas: 0, vehiculosLiberados: 0, desactivada: true }));
    return;
  }

  const prisma = new PrismaClient();
  try {
    const { expired, vehiclesReleased } = await expireReservations(new Date(), { db: prisma });
    console.log(JSON.stringify({ expiradas: expired, vehiculosLiberados: vehiclesReleased }));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(
    JSON.stringify({ error: error instanceof Error ? error.message : 'Error desconocido' })
  );
  process.exit(1);
});
