import { parseVehicleId } from '@/lib/vehicle-id';
import type { AuthUser } from '@/types/auth';
import type { RateLimitResult } from '@/server/security/rate-limit';
import type { CreateReservationResult } from './service';

export interface ReserveFormState {
  error?: string;
  /** Si el error es el tope de reservas, muestra el enlace a «Mis reservas». */
  showReservationsLink?: boolean;
}

export const initialReserveState: ReserveFormState = {};

export interface SubmitReservationContext {
  messages: {
    notAvailable: string;
    limitReached: string;
    invalidVehicle: string;
    tooManyAttempts: string;
  };
  getFreshUser: () => Promise<AuthUser | null>;
  checkAllowed: (userId: number) => RateLimitResult;
  recordAttempt: (userId: number) => void;
  createReservation: (input: {
    userId: number;
    vehicleId: number;
  }) => Promise<CreateReservationResult>;
  /** Marca y modelo del vehículo para el mensaje de WhatsApp. */
  getVehicleLabel: (vehicleId: number) => Promise<{ marca: string; modelo: string } | null>;
  /** Número de WhatsApp vigente del concesionario. */
  getDealerPhone: () => Promise<string>;
  buildWhatsAppUrl: (
    phone: string,
    data: { marca: string; modelo: string; codigo: string; nombre: string }
  ) => string;
  saveWhatsappLink: (reservationId: number, url: string) => Promise<void>;
  /** Para que la ficha del vehículo refleje el estado actual. */
  refreshCatalog: () => void;
}

export type SubmitReservationResult =
  | { status: 'state'; state: ReserveFormState }
  | { status: 'inactive' }
  | { status: 'redirect'; to: string };

function reservationPath(code: string, isNew: boolean): string {
  return `/mi-cuenta/reservas/${code}${isNew ? '?nueva=1' : ''}`;
}

/**
 * Procesa el envío del botón «Reservar». Orden, probado: sesión vigente → validación del id del vehículo
 * → límite de intentos → servicio. El id del usuario sale SIEMPRE de la sesión; del formulario solo se lee
 * `vehicleId`, que se valida con la regla estricta de `/vehiculos/[id]`.
 */
export async function submitReservation(
  formData: FormData,
  ctx: SubmitReservationContext
): Promise<SubmitReservationResult> {
  const user = await ctx.getFreshUser();
  if (!user) return { status: 'inactive' };

  const rawId = formData.get('vehicleId');
  const vehicleId = typeof rawId === 'string' ? parseVehicleId(rawId) : null;
  if (vehicleId === null) {
    return { status: 'state', state: { error: ctx.messages.invalidVehicle } };
  }

  if (!ctx.checkAllowed(user.id).allowed) {
    return { status: 'state', state: { error: ctx.messages.tooManyAttempts } };
  }
  ctx.recordAttempt(user.id);

  const result = await ctx.createReservation({ userId: user.id, vehicleId });

  switch (result.status) {
    case 'created': {
      const { id, codigoReserva } = result.reservation;
      try {
        const vehicle = await ctx.getVehicleLabel(vehicleId);
        if (vehicle) {
          const url = ctx.buildWhatsAppUrl(await ctx.getDealerPhone(), {
            ...vehicle,
            codigo: codigoReserva,
            nombre: user.name,
          });
          await ctx.saveWhatsappLink(id, url);
        }
      } catch {
        // La reserva ya está confirmada: el enlace se reconstruye al abrir la reserva (F3-03).
        console.error('No se pudo guardar el enlace de WhatsApp de la reserva', {
          reservationId: id,
        });
      }
      return { status: 'redirect', to: reservationPath(codigoReserva, true) };
    }
    case 'already_reserved_by_you':
      return { status: 'redirect', to: reservationPath(result.codigoReserva, false) };
    case 'limit_reached':
      return {
        status: 'state',
        state: { error: ctx.messages.limitReached, showReservationsLink: true },
      };
    case 'inactive_user':
      return { status: 'inactive' };
    case 'not_available':
      ctx.refreshCatalog();
      return { status: 'state', state: { error: ctx.messages.notAvailable } };
  }
}
