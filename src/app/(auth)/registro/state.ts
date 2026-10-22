import type { RegisterField } from '@/lib/validation/register';

export interface RegisterFormState {
  fieldErrors: Partial<Record<RegisterField, string>>;
  formError?: string;
  /** Valores a repoblar tras un error (nunca contraseñas). */
  values: Partial<Record<Exclude<RegisterField, 'password' | 'confirmPassword'>, string>>;
}

export const initialRegisterState: RegisterFormState = { fieldErrors: {}, values: {} };
