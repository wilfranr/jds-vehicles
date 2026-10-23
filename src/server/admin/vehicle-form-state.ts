import type { VehicleField } from '@/lib/validation/vehicle';

export interface VehicleFormState {
  fieldErrors: Partial<Record<VehicleField, string>>;
  formError?: string;
  success?: string;
  /** Valores enviados, para repoblar el formulario tras un error. */
  values: Partial<Record<VehicleField, string>>;
}

export const initialVehicleState: VehicleFormState = { fieldErrors: {}, values: {} };

export interface NameFormState {
  error?: string;
  success?: string;
}

export const initialNameState: NameFormState = {};
