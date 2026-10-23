import type { z } from 'zod';
import { firstFieldErrors, PROFILE_FIELDS, rawFormInput } from '@/lib/validation/account';
import type { ProfileField, ProfileInput } from '@/lib/validation/register';
import type { AuthUser } from '@/types/auth';

export interface ProfileFormState {
  fieldErrors: Partial<Record<ProfileField, string>>;
  formError?: string;
  success?: string;
  /** Valores a repoblar tras un error. */
  values: Partial<Record<ProfileField, string>>;
}

export const initialProfileState: ProfileFormState = { fieldErrors: {}, values: {} };

export interface UpdateProfileContext {
  schema: z.ZodType<ProfileInput>;
  messages: { errorSummary: string; saved: string };
  /** Usuario vigente en la BD (activo); `null` si no hay sesión o fue desactivado. */
  getFreshUser: () => Promise<AuthUser | null>;
  /** Actualiza SOLO la fila del id indicado, que siempre sale de la sesión. */
  updateProfile: (userId: number, data: ProfileInput) => Promise<void>;
}

export type UpdateProfileResult =
  { status: 'state'; state: ProfileFormState } | { status: 'inactive' };

function formValues(formData: FormData): ProfileFormState['values'] {
  const raw = rawFormInput(formData, PROFILE_FIELDS);
  const values: ProfileFormState['values'] = {};
  for (const field of PROFILE_FIELDS) {
    const value = raw[field];
    if (typeof value === 'string') values[field] = value.slice(0, 600);
  }
  return values;
}

/**
 * Edita el perfil del usuario de la sesión. El id nunca se lee del formulario: aunque llegue un campo
 * `id` (u otro cualquiera) se ignora, porque solo se leen los campos de `PROFILE_FIELDS`.
 */
export async function submitProfileUpdate(
  formData: FormData,
  ctx: UpdateProfileContext
): Promise<UpdateProfileResult> {
  const user = await ctx.getFreshUser();
  if (!user) return { status: 'inactive' };

  const values = formValues(formData);
  const parsed = ctx.schema.safeParse(rawFormInput(formData, PROFILE_FIELDS));
  if (!parsed.success) {
    return {
      status: 'state',
      state: {
        fieldErrors: firstFieldErrors<ProfileField>(parsed.error),
        formError: ctx.messages.errorSummary,
        values,
      },
    };
  }

  await ctx.updateProfile(user.id, parsed.data);
  return {
    status: 'state',
    state: { fieldErrors: {}, success: ctx.messages.saved, values: {} },
  };
}
