import { Disponibilidad, EstadoReserva, type PrismaClient } from '@prisma/client';
import type { ReservationEvent } from './events';
import { ACTIVE_STATES } from './service';

export interface ExpireReservationsDeps {
  db: Pick<PrismaClient, '$transaction'>;
  /** Se llama solo si expiró al menos una reserva. */
  invalidateCache?: () => void;
  logEvent?: (event: ReservationEvent) => void;
}

export interface ExpireReservationsResult {
  expired: number;
  vehiclesReleased: number;
}

/**
 * Aplica la expiración en UNA transacción:
 *  - marca `EXPIRADA` las reservas `PENDIENTE_CONTACTO` con `fechaExpiracion <= now` (las de `fechaExpiracion = null`
 *    no expiran nunca; `EN_NEGOCIACION`, `COMPLETADA` y `CANCELADA` no se tocan);
 *  - devuelve cada vehículo a `DISPONIBLE` solo si sigue `RESERVADO` y no tiene otra reserva activa.
 * Idempotente: una segunda ejecución no encuentra nada que cambiar.
 */
export async function expireReservations(
  now: Date,
  deps: ExpireReservationsDeps
): Promise<ExpireReservationsResult> {
  const result = await deps.db.$transaction(
    async (tx): Promise<ExpireReservationsResult> => {
      const due = await tx.reserva.findMany({
        where: {
          estado: EstadoReserva.PENDIENTE_CONTACTO,
          fechaExpiracion: { not: null, lte: now },
        },
        select: { id: true, vehiculoId: true },
      });
      if (due.length === 0) return { expired: 0, vehiclesReleased: 0 };

      // El estado se vuelve a exigir en el UPDATE: si alguien la cambió entre la lectura y la escritura, no se pisa.
      const expired = await tx.reserva.updateMany({
        where: { id: { in: due.map((r) => r.id) }, estado: EstadoReserva.PENDIENTE_CONTACTO },
        data: { estado: EstadoReserva.EXPIRADA },
      });

      const vehicleIds = [...new Set(due.map((r) => r.vehiculoId))];
      const released = await tx.vehiculo.updateMany({
        where: {
          id: { in: vehicleIds },
          disponibilidad: Disponibilidad.RESERVADO,
          reservas: { none: { estado: { in: ACTIVE_STATES } } },
        },
        data: { disponibilidad: Disponibilidad.DISPONIBLE },
      });

      return { expired: expired.count, vehiclesReleased: released.count };
    },
    { maxWait: 5000, timeout: 30000 }
  );

  if (result.expired > 0) {
    deps.invalidateCache?.();
    deps.logEvent?.({
      type: 'reservations_expired',
      expired: result.expired,
      vehiclesReleased: result.vehiclesReleased,
    });
  }
  return result;
}
