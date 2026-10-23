import type { Combustible, Condicion, Disponibilidad, Transmision } from '@prisma/client';
import { VEHICLE_FIELDS, type VehicleInput } from '@/lib/validation/vehicle';

/** Qué se puede cambiar de un vehículo según su estado. */
export type VehicleLock =
  /** Todo editable (disponibilidad solo entre DISPONIBLE y PROXIMAMENTE). */
  | 'none'
  /** Reserva activa o estado RESERVADO: solo precio y descripción; no se oculta. */
  | 'reserved'
  /** VENDIDO: solo lectura. */
  | 'sold';

export interface AdminVehicleDetail {
  id: number;
  modeloId: number;
  marcaId: number;
  marcaNombre: string;
  modeloNombre: string;
  anio: number;
  color: string;
  condicion: Condicion;
  placa: string | null;
  precio: string;
  kilometraje: number;
  transmision: Transmision;
  combustible: Combustible;
  cilindraje: number | null;
  descripcion: string | null;
  disponibilidad: Disponibilidad;
  visibleCatalogo: boolean;
  hasActiveReservation: boolean;
}

export function vehicleLock(vehicle: {
  disponibilidad: Disponibilidad;
  hasActiveReservation: boolean;
}): VehicleLock {
  if (vehicle.disponibilidad === 'VENDIDO') return 'sold';
  if (vehicle.disponibilidad === 'RESERVADO' || vehicle.hasActiveReservation) return 'reserved';
  return 'none';
}

/** Valores actuales como texto de formulario (la entrada del esquema). */
export function currentAsRaw(vehicle: AdminVehicleDetail): Record<string, string> {
  return {
    modeloId: String(vehicle.modeloId),
    anio: String(vehicle.anio),
    color: vehicle.color,
    condicion: vehicle.condicion,
    placa: vehicle.placa ?? '',
    precio: vehicle.precio,
    kilometraje: String(vehicle.kilometraje),
    transmision: vehicle.transmision,
    combustible: vehicle.combustible,
    cilindraje: vehicle.cilindraje === null ? '' : String(vehicle.cilindraje),
    descripcion: vehicle.descripcion ?? '',
    // Marcador: con el vehículo bloqueado la disponibilidad nunca se escribe (ver `editableData`).
    disponibilidad: 'DISPONIBLE',
  };
}

/** Lee del formulario SOLO los campos del esquema; `id`, `visibleCatalogo`, etc. se descartan. */
export function rawFromForm(source: FormData | Record<string, unknown>): Record<string, unknown> {
  const raw: Record<string, unknown> = {};
  for (const field of VEHICLE_FIELDS) {
    const value = source instanceof FormData ? source.get(field) : source[field];
    raw[field] = typeof value === 'string' ? value : undefined;
  }
  return raw;
}

/**
 * Entrada cruda para validar una edición: los campos bloqueados se toman de la BD (lo que llegue del
 * formulario para ellos se ignora) y solo los editables vienen del formulario.
 */
export function buildEditRaw(
  current: AdminVehicleDetail,
  form: FormData | Record<string, unknown>,
  lock: VehicleLock
): Record<string, unknown> {
  const fromForm = rawFromForm(form);
  if (lock === 'none') return fromForm;
  const base: Record<string, unknown> = currentAsRaw(current);
  if (lock === 'reserved') {
    base.precio = fromForm.precio;
    base.descripcion = fromForm.descripcion;
  }
  return base;
}

/** Datos que se escriben en Prisma: lista explícita según el bloqueo (nunca el cuerpo completo). */
export function editableData(lock: VehicleLock, input: VehicleInput) {
  if (lock === 'sold') return null;
  if (lock === 'reserved') {
    return { precio: input.precio, descripcion: input.descripcion ?? null };
  }
  return {
    modeloId: input.modeloId,
    anio: input.anio,
    color: input.color,
    condicion: input.condicion,
    placa: input.placa ?? null,
    precio: input.precio,
    kilometraje: input.kilometraje,
    transmision: input.transmision,
    combustible: input.combustible,
    cilindraje: input.cilindraje ?? null,
    descripcion: input.descripcion ?? null,
    disponibilidad: input.disponibilidad,
  };
}

/** Un vehículo no se puede ocultar con reserva activa; uno vendido no se muestra ni se oculta a mano. */
export function canChangeVisibility(lock: VehicleLock, nextVisible: boolean): boolean {
  if (lock === 'sold') return false;
  if (lock === 'reserved' && !nextVisible) return false;
  return true;
}
