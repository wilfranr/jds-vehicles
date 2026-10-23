'use server';

import { revalidatePath } from 'next/cache';
import { siteContent } from '@/lib/site-content';
import { createNotesSchema, createReasonSchema } from '@/lib/validation/reservation-admin';
import { logAdminEvent } from '@/server/admin/audit';
import type { ActionState } from '@/server/admin/reservation-form-state';
import {
  changeReservationState,
  saveReservationNotes,
  type StaffTransitionResult,
} from '@/server/admin/reservations';
import { requireStaff } from '@/server/auth/staff';
import { invalidateCatalogFromAction } from '@/server/reservations';
import { parseReservationCode } from '@/server/reservations/code';

const copy = siteContent.adminReservations;
const lengthMessages = { notes: copy.notesTooLong, reason: copy.cancelReasonTooLong };
const notesSchema = createNotesSchema(lengthMessages);
const reasonSchema = createReasonSchema(lengthMessages);

/** El código sale del enlace de la página (parámetro enlazado) y se vuelve a validar: nunca se confía en él. */
function validCode(raw: string): string | null {
  return parseReservationCode(raw);
}

function describe(result: StaffTransitionResult) {
  if (result.status === 'not_found') return { error: copy.errors.notFound };
  if (result.status === 'invalid_transition') return { error: copy.errors.invalidTransition };
  return null;
}

export async function startNegotiationAction(
  rawCode: string,
  _previous: ActionState,
  _formData: FormData
): Promise<ActionState> {
  const code = validCode(rawCode);
  if (!code) return { error: copy.errors.notFound };
  const user = await requireStaff(`/admin/reservas/${code}`);

  const result = await changeReservationState(code, 'EN_NEGOCIACION');
  const failure = describe(result);
  if (failure) return failure;
  if (result.status !== 'ok') return { error: copy.errors.generic };

  logAdminEvent({
    actorId: user.id,
    action: 'reservation.negotiation_started',
    entity: 'reservation',
    entityId: result.id,
    detail: 'PENDIENTE_CONTACTO→EN_NEGOCIACION',
  });
  revalidatePath(`/admin/reservas/${code}`);
  revalidatePath('/admin/reservas');
  return { success: copy.negotiationStarted };
}

export async function cancelReservationAction(
  rawCode: string,
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const code = validCode(rawCode);
  if (!code) return { error: copy.errors.notFound };
  const user = await requireStaff(`/admin/reservas/${code}`);

  // Del formulario solo se lee el motivo (opcional).
  const reason = reasonSchema.safeParse(formData.get('motivo') ?? '');
  if (!reason.success) return { error: copy.cancelReasonTooLong };

  const result = await changeReservationState(code, 'CANCELADA', reason.data || undefined);
  const failure = describe(result);
  if (failure) return failure;
  if (result.status !== 'ok') return { error: copy.errors.generic };

  logAdminEvent({
    actorId: user.id,
    action: 'reservation.cancelled',
    entity: 'reservation',
    entityId: result.id,
    detail: result.vehicleReleased ? 'vehículo liberado' : 'vehículo sin cambios',
  });
  // El catálogo debe reflejar al instante que el vehículo volvió a estar disponible.
  invalidateCatalogFromAction();
  revalidatePath(`/admin/reservas/${code}`);
  revalidatePath('/admin/reservas');
  return { success: result.vehicleReleased ? copy.cancelled : copy.cancelledVehicleKept };
}

export async function saveNotesAction(
  rawCode: string,
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const code = validCode(rawCode);
  if (!code) return { error: copy.errors.notFound };
  const user = await requireStaff(`/admin/reservas/${code}`);

  const notes = notesSchema.safeParse(formData.get('observaciones') ?? '');
  if (!notes.success) return { error: copy.notesTooLong };

  const result = await saveReservationNotes(code, notes.data);
  if (result.status !== 'ok') return { error: copy.errors.notFound };

  // Solo quién y cuándo (el registro lleva la marca de tiempo); nunca el texto de las observaciones.
  logAdminEvent({
    actorId: user.id,
    action: 'reservation.notes_updated',
    entity: 'reservation',
    entityId: result.id,
  });
  revalidatePath(`/admin/reservas/${code}`);
  return { success: copy.notesSaved };
}
