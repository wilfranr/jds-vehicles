'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { siteContent } from '@/lib/site-content';
import { createIdSchema, createNameSchema } from '@/lib/validation/catalog-admin';
import {
  createVehicleSchema,
  VEHICLE_FIELDS,
  type VehicleField,
  type VehicleMessages,
} from '@/lib/validation/vehicle';
import { logAdminEvent } from '@/server/admin/audit';
import {
  createBrand,
  createModel,
  renameBrand,
  renameModel,
  setBrandActive,
  setModelActive,
  type CatalogWriteResult,
} from '@/server/admin/catalog-admin';
import type { NameFormState, VehicleFormState } from '@/server/admin/vehicle-form-state';
import { buildEditRaw, editableData, rawFromForm, vehicleLock } from '@/server/admin/vehicle-rules';
import { createVehicle, setVehicleVisibility, updateVehicle } from '@/server/admin/vehicles';
import { requireStaff } from '@/server/auth/staff';
import { invalidateCatalogFromAction } from '@/server/reservations';

const copy = siteContent.adminVehicles;
const messages: VehicleMessages = {
  modelo: copy.errors.modelo,
  anio: copy.errors.anio,
  color: copy.errors.color,
  condicion: copy.errors.condicion,
  placa: copy.errors.placa,
  placaRequired: copy.errors.placaRequired,
  placaNotForNew: copy.errors.placaNotForNew,
  precio: copy.errors.precio,
  kilometraje: copy.errors.kilometraje,
  kilometrajeNew: copy.errors.kilometrajeNew,
  transmision: copy.errors.transmision,
  combustible: copy.errors.combustible,
  cilindraje: copy.errors.cilindraje,
  descripcion: copy.errors.descripcion,
  disponibilidad: copy.errors.disponibilidad,
};
const schema = createVehicleSchema(messages);
const brandNames = createNameSchema({
  name: copy.brands.errors.name,
  brand: copy.brands.errors.brand,
});
const ids = createIdSchema(copy.brands.errors.generic);

function submittedValues(formData: FormData): VehicleFormState['values'] {
  const values: VehicleFormState['values'] = {};
  for (const field of VEHICLE_FIELDS) {
    const value = formData.get(field);
    if (typeof value === 'string') values[field] = value.slice(0, 2300);
  }
  return values;
}

function fieldErrorsOf(error: {
  issues: { path: PropertyKey[]; message: string }[];
}): VehicleFormState['fieldErrors'] {
  const errors: VehicleFormState['fieldErrors'] = {};
  for (const issue of error.issues) {
    const key = issue.path[0] as VehicleField | undefined;
    if (key && !errors[key]) errors[key] = issue.message;
  }
  return errors;
}

export async function createVehicleAction(
  _previous: VehicleFormState,
  formData: FormData
): Promise<VehicleFormState> {
  const user = await requireStaff('/admin/vehiculos/nuevo');
  const values = submittedValues(formData);

  const parsed = schema.safeParse(rawFromForm(formData));
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsOf(parsed.error), formError: copy.errorSummary, values };
  }

  const result = await createVehicle(parsed.data);
  if (result.status === 'plate_duplicate') {
    return {
      fieldErrors: { placa: copy.errors.placaDuplicate },
      formError: copy.errorSummary,
      values,
    };
  }
  if (result.status === 'model_invalid') {
    return { fieldErrors: { modeloId: copy.errors.modelo }, formError: copy.errorSummary, values };
  }
  if (result.status !== 'ok') return { fieldErrors: {}, formError: copy.errors.generic, values };

  logAdminEvent({
    actorId: user.id,
    action: 'vehicle.created',
    entity: 'vehicle',
    entityId: result.id,
  });
  invalidateCatalogFromAction();
  redirect(`/admin/vehiculos/${result.id}?creado=1`);
}

export async function updateVehicleAction(
  vehicleId: number,
  _previous: VehicleFormState,
  formData: FormData
): Promise<VehicleFormState> {
  const user = await requireStaff(`/admin/vehiculos/${vehicleId}`);
  const values = submittedValues(formData);

  // El id sale del enlace de la página (parámetro enlazado), nunca del formulario.
  let formErrors: VehicleFormState['fieldErrors'] = {};
  let changed: string[] = [];
  const result = await updateVehicle(vehicleId, (current) => {
    const lock = vehicleLock(current);
    const parsed = schema.safeParse(buildEditRaw(current, formData, lock));
    if (!parsed.success) {
      formErrors = fieldErrorsOf(parsed.error);
      return null;
    }
    changed = Object.keys(editableData(lock, parsed.data) ?? {});
    return parsed.data;
  });

  switch (result.status) {
    case 'invalid':
      return { fieldErrors: formErrors, formError: copy.errorSummary, values };
    case 'plate_duplicate':
      return {
        fieldErrors: { placa: copy.errors.placaDuplicate },
        formError: copy.errorSummary,
        values,
      };
    case 'model_invalid':
      return {
        fieldErrors: { modeloId: copy.errors.modelo },
        formError: copy.errorSummary,
        values,
      };
    case 'locked':
      return { fieldErrors: {}, formError: copy.errors.locked, values: {} };
    case 'not_found':
      return { fieldErrors: {}, formError: copy.errors.notFound, values: {} };
    case 'ok':
      break;
  }

  logAdminEvent({
    actorId: user.id,
    action: 'vehicle.updated',
    entity: 'vehicle',
    entityId: vehicleId,
    detail: `campos: ${changed.join(',')}`,
  });
  invalidateCatalogFromAction();
  revalidatePath(`/admin/vehiculos/${vehicleId}`);
  return { fieldErrors: {}, success: copy.saved, values: {} };
}

export async function setVisibilityAction(
  vehicleId: number,
  visible: boolean,
  _formData: FormData
): Promise<void> {
  const user = await requireStaff('/admin/vehiculos');
  const result = await setVehicleVisibility(vehicleId, visible);
  if (result.status !== 'ok') return; // la interfaz ya no ofrece el botón en estados bloqueados
  logAdminEvent({
    actorId: user.id,
    action: visible ? 'vehicle.shown' : 'vehicle.hidden',
    entity: 'vehicle',
    entityId: vehicleId,
  });
  invalidateCatalogFromAction();
  revalidatePath('/admin/vehiculos');
}

// ---------------------------------------------------------------- marcas y modelos

function nameResult(
  result: CatalogWriteResult,
  action: string,
  entity: string,
  actorId: number
): NameFormState {
  if (result.status === 'duplicate') return { error: copy.brands.errors.duplicate };
  if (result.status === 'not_found') return { error: copy.brands.errors.brand };
  logAdminEvent({ actorId, action, entity, entityId: result.id });
  invalidateCatalogFromAction();
  revalidatePath('/admin/vehiculos/marcas');
  return { success: copy.brands.saved };
}

export async function createBrandAction(
  _previous: NameFormState,
  formData: FormData
): Promise<NameFormState> {
  const user = await requireStaff('/admin/vehiculos/marcas');
  const name = brandNames.safeParse(formData.get('nombre'));
  if (!name.success) return { error: copy.brands.errors.name };
  return nameResult(await createBrand(name.data), 'brand.created', 'brand', user.id);
}

export async function renameBrandAction(
  _previous: NameFormState,
  formData: FormData
): Promise<NameFormState> {
  const user = await requireStaff('/admin/vehiculos/marcas');
  const id = ids.safeParse(formData.get('id'));
  const name = brandNames.safeParse(formData.get('nombre'));
  if (!id.success) return { error: copy.brands.errors.generic };
  if (!name.success) return { error: copy.brands.errors.name };
  return nameResult(await renameBrand(id.data, name.data), 'brand.renamed', 'brand', user.id);
}

export async function setBrandActiveAction(
  active: boolean,
  _previous: NameFormState,
  formData: FormData
): Promise<NameFormState> {
  const user = await requireStaff('/admin/vehiculos/marcas');
  const id = ids.safeParse(formData.get('id'));
  if (!id.success) return { error: copy.brands.errors.generic };
  return nameResult(
    await setBrandActive(id.data, active),
    active ? 'brand.activated' : 'brand.deactivated',
    'brand',
    user.id
  );
}

export async function createModelAction(
  _previous: NameFormState,
  formData: FormData
): Promise<NameFormState> {
  const user = await requireStaff('/admin/vehiculos/marcas');
  const brandId = ids.safeParse(formData.get('marcaId'));
  const name = brandNames.safeParse(formData.get('nombre'));
  if (!brandId.success) return { error: copy.brands.errors.brand };
  if (!name.success) return { error: copy.brands.errors.name };
  return nameResult(await createModel(brandId.data, name.data), 'model.created', 'model', user.id);
}

export async function renameModelAction(
  _previous: NameFormState,
  formData: FormData
): Promise<NameFormState> {
  const user = await requireStaff('/admin/vehiculos/marcas');
  const id = ids.safeParse(formData.get('id'));
  const name = brandNames.safeParse(formData.get('nombre'));
  if (!id.success) return { error: copy.brands.errors.generic };
  if (!name.success) return { error: copy.brands.errors.name };
  return nameResult(await renameModel(id.data, name.data), 'model.renamed', 'model', user.id);
}

export async function setModelActiveAction(
  active: boolean,
  _previous: NameFormState,
  formData: FormData
): Promise<NameFormState> {
  const user = await requireStaff('/admin/vehiculos/marcas');
  const id = ids.safeParse(formData.get('id'));
  if (!id.success) return { error: copy.brands.errors.generic };
  return nameResult(
    await setModelActive(id.data, active),
    active ? 'model.activated' : 'model.deactivated',
    'model',
    user.id
  );
}
