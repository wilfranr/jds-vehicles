'use client';

import React, { useActionState } from 'react';
import { siteContent } from '@/lib/site-content';
import { initialVehicleState, type VehicleFormState } from '@/server/admin/vehicle-form-state';
import {
  COMBUSTIBLES,
  CONDICIONES,
  MANUAL_DISPONIBILIDADES,
  TRANSMISIONES,
  type VehicleField,
} from '@/lib/validation/vehicle';
import type { AdminVehicleDetail, VehicleLock } from '@/server/admin/vehicle-rules';
import { AdminField, adminInputClass } from './AdminField';

const copy = siteContent.adminVehicles;

interface VehicleFormProps {
  action: (previous: VehicleFormState, formData: FormData) => Promise<VehicleFormState>;
  models: { id: number; label: string }[];
  /** `null` al crear. */
  vehicle: AdminVehicleDetail | null;
  lock: VehicleLock;
}

/** Formulario de vehículo (crear y editar). Con el vehículo bloqueado, los campos críticos van deshabilitados. */
export function VehicleForm({ action, models, vehicle, lock }: VehicleFormProps) {
  const [state, formAction, pending] = useActionState(action, initialVehicleState);
  const errors = state.fieldErrors;
  const hasValues = Object.keys(state.values).length > 0;

  function initial(field: VehicleField): string {
    if (hasValues) return state.values[field] ?? '';
    if (!vehicle)
      return field === 'disponibilidad' ? 'DISPONIBLE' : field === 'kilometraje' ? '0' : '';
    switch (field) {
      case 'modeloId':
        return String(vehicle.modeloId);
      case 'placa':
        return vehicle.placa ?? '';
      case 'cilindraje':
        return vehicle.cilindraje === null ? '' : String(vehicle.cilindraje);
      case 'descripcion':
        return vehicle.descripcion ?? '';
      case 'disponibilidad':
        return MANUAL_DISPONIBILIDADES.includes(vehicle.disponibilidad as 'DISPONIBLE')
          ? vehicle.disponibilidad
          : 'DISPONIBLE';
      default:
        return String(vehicle[field as keyof AdminVehicleDetail] ?? '');
    }
  }

  // Campos críticos: bloqueados con reserva activa o venta. Precio y descripción solo se bloquean si está vendido.
  const criticalDisabled = lock !== 'none';
  const softDisabled = lock === 'sold';

  const field = (name: VehicleField, label: string, hint?: string, optional?: boolean) => ({
    id: `veh-${name}`,
    label: optional ? `${label} ${copy.optionalSuffix}` : label,
    hint,
    error: errors[name],
  });

  type ControlProps = { describedBy: string | undefined; invalid: boolean };

  /** Devuelve la función de render que espera `AdminField` para un `<select>`. */
  const select = (
    name: VehicleField,
    options: { value: string; label: string }[],
    disabled: boolean,
    withPlaceholder = true
  ) => {
    const render = (props: ControlProps) => (
      <select
        id={`veh-${name}`}
        name={name}
        defaultValue={initial(name)}
        disabled={disabled}
        aria-invalid={props.invalid}
        aria-describedby={props.describedBy}
        className={adminInputClass}
      >
        {withPlaceholder && <option value="">{copy.selectPlaceholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
    render.displayName = `Select(${name})`;
    return render;
  };

  const text = (
    name: VehicleField,
    disabled: boolean,
    extra: React.InputHTMLAttributes<HTMLInputElement> = {}
  ) => {
    const render = (props: ControlProps) => (
      <input
        id={`veh-${name}`}
        name={name}
        defaultValue={initial(name)}
        disabled={disabled}
        aria-invalid={props.invalid}
        aria-describedby={props.describedBy}
        className={adminInputClass}
        {...extra}
      />
    );
    render.displayName = `Text(${name})`;
    return render;
  };

  return (
    <form action={formAction} noValidate className="flex flex-col gap-5">
      {state.success && (
        <div
          role="status"
          className="bg-surface-container text-on-surface border-outline-variant/40 rounded-lg border px-4 py-3 text-sm font-medium"
        >
          {state.success}
        </div>
      )}
      {state.formError && (
        <div
          role="alert"
          className="bg-error-container text-on-error-container rounded-lg px-4 py-3 text-sm"
        >
          {state.formError}
        </div>
      )}
      {lock === 'reserved' && (
        <p className="bg-surface-container text-on-surface rounded-lg px-4 py-3 text-sm">
          {copy.lockedReserved}
        </p>
      )}
      {lock === 'sold' && (
        <p className="bg-surface-container text-on-surface rounded-lg px-4 py-3 text-sm">
          {copy.lockedSold}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <AdminField {...field('modeloId', copy.labels.modeloId)}>
          {select(
            'modeloId',
            models.map((m) => ({ value: String(m.id), label: m.label })),
            criticalDisabled
          )}
        </AdminField>
        <AdminField {...field('anio', copy.labels.anio)}>
          {text('anio', criticalDisabled, { inputMode: 'numeric', maxLength: 4 })}
        </AdminField>
        <AdminField {...field('color', copy.labels.color)}>
          {text('color', criticalDisabled, { maxLength: 50 })}
        </AdminField>
        <AdminField {...field('condicion', copy.labels.condicion)}>
          {select(
            'condicion',
            CONDICIONES.map((c) => ({ value: c, label: copy.conditionLabels[c] })),
            criticalDisabled
          )}
        </AdminField>
        <AdminField {...field('placa', copy.labels.placa, copy.hints.placa, true)}>
          {text('placa', criticalDisabled, { maxLength: 30, autoCapitalize: 'characters' })}
        </AdminField>
        <AdminField {...field('kilometraje', copy.labels.kilometraje, copy.hints.kilometraje)}>
          {text('kilometraje', criticalDisabled, { inputMode: 'numeric', maxLength: 7 })}
        </AdminField>
        <AdminField {...field('transmision', copy.labels.transmision)}>
          {select(
            'transmision',
            TRANSMISIONES.map((t) => ({ value: t, label: copy.transmisionLabels[t] })),
            criticalDisabled
          )}
        </AdminField>
        <AdminField {...field('combustible', copy.labels.combustible)}>
          {select(
            'combustible',
            COMBUSTIBLES.map((c) => ({ value: c, label: copy.combustibleLabels[c] })),
            criticalDisabled
          )}
        </AdminField>
        <AdminField {...field('cilindraje', copy.labels.cilindraje, copy.hints.cilindraje, true)}>
          {text('cilindraje', criticalDisabled, { inputMode: 'numeric', maxLength: 5 })}
        </AdminField>
        <AdminField {...field('precio', copy.labels.precio, copy.hints.precio)}>
          {text('precio', softDisabled, { inputMode: 'decimal', maxLength: 13 })}
        </AdminField>
        <AdminField
          {...field(
            'disponibilidad',
            copy.labels.disponibilidad,
            criticalDisabled ? copy.availabilityLocked : copy.hints.disponibilidad
          )}
        >
          {select(
            'disponibilidad',
            MANUAL_DISPONIBILIDADES.map((d) => ({ value: d, label: copy.availabilityLabels[d] })),
            criticalDisabled,
            false
          )}
        </AdminField>
      </div>

      <AdminField {...field('descripcion', copy.labels.descripcion, copy.hints.descripcion, true)}>
        {({ describedBy, invalid }) => (
          <textarea
            id="veh-descripcion"
            name="descripcion"
            rows={5}
            maxLength={2200}
            defaultValue={initial('descripcion')}
            disabled={softDisabled}
            aria-invalid={invalid}
            aria-describedby={describedBy}
            className={adminInputClass}
          />
        )}
      </AdminField>

      {lock !== 'sold' && (
        <button
          type="submit"
          disabled={pending}
          className="bg-primary text-on-primary font-label-lg focus-visible:ring-primary w-full rounded-lg px-4 py-3 text-sm shadow-sm transition-colors hover:bg-neutral-800 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-60 sm:w-auto sm:self-start"
        >
          {pending ? copy.submitting : vehicle ? copy.submitSave : copy.submitCreate}
        </button>
      )}
    </form>
  );
}
