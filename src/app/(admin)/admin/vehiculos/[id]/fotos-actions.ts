'use server';

import { revalidatePath } from 'next/cache';
import { siteContent } from '@/lib/site-content';
import { vehicleIdSchemaFor } from '@/lib/vehicle-id';
import { logAdminEvent } from '@/server/admin/audit';
import { deletePhoto, movePhoto, setPrincipalPhoto } from '@/server/admin/photos';
import type { ActionState } from '@/server/admin/reservation-form-state';
import { requireStaff } from '@/server/auth/staff';
import { deleteImagePair, getUploadsDir } from '@/server/media/storage';
import { invalidateCatalogFromAction } from '@/server/reservations';

const copy = siteContent.adminPhotos;
const ids = vehicleIdSchemaFor(copy.errors.generic);

/** Los ids llegan enlazados desde la página y se validan; del formulario no se lee nada. */
async function authorize(rawVehicleId: number, rawPhotoId: number) {
  const user = await requireStaff(`/admin/vehiculos/${rawVehicleId}`);
  const vehicleId = ids.safeParse(rawVehicleId);
  const photoId = ids.safeParse(rawPhotoId);
  if (!vehicleId.success || !photoId.success) return null;
  return { user, vehicleId: vehicleId.data, photoId: photoId.data };
}

function done(vehicleId: number): ActionState {
  invalidateCatalogFromAction();
  revalidatePath(`/admin/vehiculos/${vehicleId}`);
  return { success: copy.changed };
}

export async function setPrincipalAction(
  rawVehicleId: number,
  rawPhotoId: number,
  _previous: ActionState,
  _formData: FormData
): Promise<ActionState> {
  const ctx = await authorize(rawVehicleId, rawPhotoId);
  if (!ctx) return { error: copy.errors.generic };
  const result = await setPrincipalPhoto(ctx.vehicleId, ctx.photoId);
  if (result.status !== 'ok') return { error: copy.errors.notFound };
  logAdminEvent({
    actorId: ctx.user.id,
    action: 'vehicle.photo_principal_set',
    entity: 'vehicle_photo',
    entityId: ctx.photoId,
    detail: `vehículo ${ctx.vehicleId}`,
  });
  return done(ctx.vehicleId);
}

export async function movePhotoAction(
  rawVehicleId: number,
  rawPhotoId: number,
  direction: 'up' | 'down',
  _previous: ActionState,
  _formData: FormData
): Promise<ActionState> {
  const ctx = await authorize(rawVehicleId, rawPhotoId);
  if (!ctx || (direction !== 'up' && direction !== 'down')) return { error: copy.errors.generic };
  const result = await movePhoto(ctx.vehicleId, ctx.photoId, direction);
  if (result.status !== 'ok') return { error: copy.errors.notFound };
  logAdminEvent({
    actorId: ctx.user.id,
    action: 'vehicle.photo_moved',
    entity: 'vehicle_photo',
    entityId: ctx.photoId,
    detail: `vehículo ${ctx.vehicleId}: ${direction}`,
  });
  return done(ctx.vehicleId);
}

export async function deletePhotoAction(
  rawVehicleId: number,
  rawPhotoId: number,
  _previous: ActionState,
  _formData: FormData
): Promise<ActionState> {
  const ctx = await authorize(rawVehicleId, rawPhotoId);
  if (!ctx) return { error: copy.errors.generic };
  const result = await deletePhoto(ctx.vehicleId, ctx.photoId);
  if (result.status !== 'ok') return { error: copy.errors.notFound };

  // Fila ya eliminada: se borra el archivo (solo si la URL es una foto subida por el panel; las del seed no).
  try {
    await deleteImagePair(getUploadsDir(), result.url);
  } catch {
    console.error('No se pudo borrar el archivo de una foto eliminada', { photoId: ctx.photoId });
  }
  logAdminEvent({
    actorId: ctx.user.id,
    action: 'vehicle.photo_deleted',
    entity: 'vehicle_photo',
    entityId: ctx.photoId,
    detail: `vehículo ${ctx.vehicleId}`,
  });
  const state = done(ctx.vehicleId);
  return { success: copy.removed, ...(state.error ? { error: state.error } : {}) };
}
