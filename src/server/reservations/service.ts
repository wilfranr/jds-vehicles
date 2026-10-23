import { Disponibilidad, EstadoReserva, Prisma, type PrismaClient } from '@prisma/client';
import { generateReservationCode } from './code';
import { expirationDate, MAX_ACTIVE_RESERVATIONS_PER_USER } from './config';
import type { ReservationEvent, ReservationRejection } from './events';

export const ACTIVE_STATES: EstadoReserva[] = [
  EstadoReserva.PENDIENTE_CONTACTO,
  EstadoReserva.EN_NEGOCIACION,
];

const MAX_CODE_ATTEMPTS = 5;

export interface CreatedReservation {
  id: number;
  codigoReserva: string;
  vehiculoId: number;
  usuarioId: number;
  fechaExpiracion: Date | null;
}

/** Resultado tipado: los casos de negocio nunca lanzan. */
export type CreateReservationResult =
  | { status: 'created'; reservation: CreatedReservation }
  /** Incluye el código de la reserva existente para llevar al usuario a ella. */
  | { status: 'already_reserved_by_you'; codigoReserva: string }
  | { status: Exclude<ReservationRejection, 'already_reserved_by_you'> };

export interface CreateReservationDeps {
  db: Pick<PrismaClient, '$transaction'>;
  /** Invalida la caché del catálogo tras confirmar la transacción (ver `cache.ts`). */
  invalidateCache: () => void;
  logEvent?: (event: ReservationEvent) => void;
  now?: () => Date;
  /** Horas de vigencia; `null` = sin expiración. */
  expirationHours: number | null;
  generateCode?: (now: Date) => string;
  maxActivePerUser?: number;
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

/**
 * Reserva un vehículo para un usuario en UNA transacción:
 *  1. bloquea la fila del usuario (`FOR UPDATE`): serializa sus reservas y hace fiable el tope por usuario;
 *  2. comprueba usuario activo, reserva propia ya activa y tope;
 *  3. cambia el vehículo a `RESERVADO` con un `updateMany` condicionado a `DISPONIBLE` y exige `count === 1`
 *     (si dos usuarios compiten, solo uno gana; leer y luego escribir no bastaría);
 *  4. crea la reserva `PENDIENTE_CONTACTO` con código único (hasta 5 reintentos ante colisión).
 * Todo resultado de negocio se devuelve sin escribir nada; un error inesperado revierte la transacción.
 */
export async function createReservation(
  input: { userId: number; vehicleId: number },
  deps: CreateReservationDeps
): Promise<CreateReservationResult> {
  const { userId, vehicleId } = input;
  const now = (deps.now ?? (() => new Date()))();
  const generateCode = deps.generateCode ?? ((at: Date) => generateReservationCode(at));
  const maxActive = deps.maxActivePerUser ?? MAX_ACTIVE_RESERVATIONS_PER_USER;
  const logEvent = deps.logEvent ?? (() => {});

  const result = await deps.db.$transaction(
    async (tx): Promise<CreateReservationResult> => {
      const locked = await tx.$queryRaw<{ activo: number | boolean }[]>(
        Prisma.sql`SELECT activo FROM usuarios WHERE id = ${userId} FOR UPDATE`
      );
      if (locked.length === 0 || !locked[0]!.activo) return { status: 'inactive_user' };

      const own = await tx.reserva.findFirst({
        where: { usuarioId: userId, vehiculoId: vehicleId, estado: { in: ACTIVE_STATES } },
        select: { codigoReserva: true },
      });
      if (own) return { status: 'already_reserved_by_you', codigoReserva: own.codigoReserva };

      const activeCount = await tx.reserva.count({
        where: { usuarioId: userId, estado: { in: ACTIVE_STATES } },
      });
      if (activeCount >= maxActive) return { status: 'limit_reached' };

      const vehicle = await tx.vehiculo.findUnique({
        where: { id: vehicleId },
        select: { disponibilidad: true, visibleCatalogo: true },
      });
      if (
        !vehicle ||
        !vehicle.visibleCatalogo ||
        vehicle.disponibilidad !== Disponibilidad.DISPONIBLE
      ) {
        return { status: 'not_available' };
      }

      const won = await tx.vehiculo.updateMany({
        where: {
          id: vehicleId,
          disponibilidad: Disponibilidad.DISPONIBLE,
          visibleCatalogo: true,
        },
        data: { disponibilidad: Disponibilidad.RESERVADO },
      });
      if (won.count !== 1) return { status: 'not_available' };

      for (let attempt = 1; ; attempt++) {
        try {
          const reservation = await tx.reserva.create({
            data: {
              codigoReserva: generateCode(now),
              vehiculoId: vehicleId,
              usuarioId: userId,
              estado: EstadoReserva.PENDIENTE_CONTACTO,
              fechaReserva: now,
              fechaExpiracion: expirationDate(now, deps.expirationHours),
            },
            select: {
              id: true,
              codigoReserva: true,
              vehiculoId: true,
              usuarioId: true,
              fechaExpiracion: true,
            },
          });
          return { status: 'created', reservation };
        } catch (error) {
          // En MySQL un duplicado no aborta la transacción: se reintenta con otro código.
          if (isUniqueViolation(error) && attempt < MAX_CODE_ATTEMPTS) continue;
          throw error;
        }
      }
    },
    { maxWait: 5000, timeout: 10000 }
  );

  if (result.status === 'created') {
    deps.invalidateCache();
    logEvent({
      type: 'reservation_created',
      userId,
      vehicleId,
      reservationId: result.reservation.id,
    });
  } else {
    logEvent({ type: 'reservation_rejected', userId, vehicleId, reason: result.status });
  }
  return result;
}
