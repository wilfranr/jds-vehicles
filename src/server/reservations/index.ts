import 'server-only';

import { prisma } from '@/lib/db';
import { parseReservationExpirationHours } from './config';
import { logReservationEvent } from './events';
import {
  createReservation as createReservationWith,
  type CreateReservationDeps,
  type CreateReservationResult,
} from './service';

export { MAX_ACTIVE_RESERVATIONS_PER_USER } from './config';
export { invalidateCatalogFromAction, invalidateCatalogInBackground } from './cache';
export type { CreateReservationResult } from './service';

/** `createReservation` con la BD real, la configuración del entorno y el registro de auditoría. */
export function createReservation(
  input: { userId: number; vehicleId: number },
  deps: Pick<CreateReservationDeps, 'invalidateCache'> & Partial<CreateReservationDeps>
): Promise<CreateReservationResult> {
  return createReservationWith(input, {
    db: prisma,
    expirationHours: parseReservationExpirationHours(),
    logEvent: logReservationEvent,
    ...deps,
  });
}
