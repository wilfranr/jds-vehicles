import { z } from 'zod';
import { createPasswordRule, type RegisterMessages } from './register';

export interface ChangePasswordMessages {
  currentRequired: string;
  /** Mensajes de la contraseña nueva (los mismos del registro). */
  password: RegisterMessages;
}

export function createChangePasswordSchema(m: ChangePasswordMessages) {
  return z
    .object({
      // Sin reglas de formato: la contraseña actual solo se compara con el hash guardado.
      currentPassword: z.string(m.currentRequired).min(1, m.currentRequired).max(1000),
      newPassword: createPasswordRule(m.password),
      confirmPassword: z.string(m.password.passwordMismatch).max(1000, m.password.passwordMismatch),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      path: ['confirmPassword'],
      message: m.password.passwordMismatch,
    });
}

export type ChangePasswordInput = z.output<ReturnType<typeof createChangePasswordSchema>>;
export type ChangePasswordField = keyof ChangePasswordInput;

export const CHANGE_PASSWORD_FIELDS = [
  'currentPassword',
  'newPassword',
  'confirmPassword',
] as const satisfies readonly ChangePasswordField[];

export const PROFILE_FIELDS = ['nombre', 'apellido', 'telefono', 'ciudad', 'direccion'] as const;

/** Entrada cruda de un formulario: solo los campos conocidos; cualquier otro (p. ej. `id`) se descarta. */
export function rawFormInput(
  formData: FormData,
  fields: readonly string[]
): Record<string, unknown> {
  const raw: Record<string, unknown> = {};
  for (const field of fields) {
    const value = formData.get(field);
    raw[field] = typeof value === 'string' ? value : undefined;
  }
  return raw;
}

/** Primer mensaje de error por campo a partir de un resultado fallido de `safeParse`. */
export function firstFieldErrors<F extends string>(error: z.ZodError): Partial<Record<F, string>> {
  const errors: Partial<Record<F, string>> = {};
  for (const issue of error.issues) {
    const key = issue.path[0] as F | undefined;
    if (key && !errors[key]) errors[key] = issue.message;
  }
  return errors;
}
