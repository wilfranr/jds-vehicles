import { logEvent } from '@/server/log';

export type ReservationRejection =
  'not_available' | 'already_reserved_by_you' | 'limit_reached' | 'inactive_user';

export type ReservationEvent =
  | { type: 'reservations_expired'; expired: number; vehiclesReleased: number }
  | { type: 'reservation_created'; userId: number; vehicleId: number; reservationId: number }
  | {
      type: 'reservation_rejected';
      userId: number;
      vehicleId: number;
      reason: ReservationRejection;
    };

/** Una línea JSON en la salida estándar. Solo ids y motivo: sin nombres, correos ni teléfonos. */
export function logReservationEvent(event: ReservationEvent): void {
  logEvent({ channel: 'reservations', ...event });
}
