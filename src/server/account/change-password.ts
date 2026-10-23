import type { z } from 'zod';
import {
  CHANGE_PASSWORD_FIELDS,
  firstFieldErrors,
  rawFormInput,
  type ChangePasswordField,
  type ChangePasswordInput,
} from '@/lib/validation/account';
import type { RateLimitResult } from '@/server/security/rate-limit';
import type { SecurityEvent } from '@/server/security/audit';
import type { AuthUser } from '@/types/auth';

export interface ChangePasswordFormState {
  fieldErrors: Partial<Record<ChangePasswordField, string>>;
  formError?: string;
  success?: string;
}

export const initialChangePasswordState: ChangePasswordFormState = { fieldErrors: {} };

export interface ChangePasswordContext {
  ip: string;
  schema: z.ZodType<ChangePasswordInput>;
  messages: {
    errorSummary: string;
    currentWrong: string;
    sameAsCurrent: string;
    tooManyAttempts: string;
    changed: string;
  };
  getFreshUser: () => Promise<AuthUser | null>;
  /** Debe consultarse ANTES de verificar la contraseña actual. Clave: id del usuario. */
  checkAllowed: (userId: number) => RateLimitResult;
  recordFailure: (userId: number) => void;
  recordSuccess: (userId: number) => void;
  logEvent: (event: SecurityEvent) => void;
  getPasswordHash: (userId: number) => Promise<string | null>;
  comparePassword: (plain: string, hash: string) => Promise<boolean>;
  hashPassword: (plain: string) => Promise<string>;
  savePasswordHash: (userId: number, hash: string) => Promise<void>;
}

export type ChangePasswordResult =
  { status: 'state'; state: ChangePasswordFormState } | { status: 'inactive' };

/**
 * Cambio de contraseña del usuario de la sesión. Orden, probado: usuario vigente → límite de intentos →
 * validación (barata, no revela nada de la clave actual) → contraseña actual → nueva distinta → hash y guardado.
 * Solo los fallos de contraseña actual consumen cupo (5 cada 15 minutos por usuario).
 * Nunca se registran contraseñas ni hashes.
 */
export async function submitChangePassword(
  formData: FormData,
  ctx: ChangePasswordContext
): Promise<ChangePasswordResult> {
  const user = await ctx.getFreshUser();
  if (!user) return { status: 'inactive' };

  const fail = (state: ChangePasswordFormState): ChangePasswordResult => ({
    status: 'state',
    state,
  });

  if (!ctx.checkAllowed(user.id).allowed) {
    ctx.logEvent({ type: 'password_change_blocked', userId: user.id, ip: ctx.ip });
    return fail({ fieldErrors: {}, formError: ctx.messages.tooManyAttempts });
  }

  const parsed = ctx.schema.safeParse(rawFormInput(formData, CHANGE_PASSWORD_FIELDS));
  if (!parsed.success) {
    return fail({
      fieldErrors: firstFieldErrors<ChangePasswordField>(parsed.error),
      formError: ctx.messages.errorSummary,
    });
  }
  const { currentPassword, newPassword } = parsed.data;

  const hash = await ctx.getPasswordHash(user.id);
  const currentMatches = hash !== null && (await ctx.comparePassword(currentPassword, hash));
  if (!currentMatches) {
    ctx.recordFailure(user.id);
    ctx.logEvent({ type: 'password_change_failed', userId: user.id, ip: ctx.ip });
    return fail({ fieldErrors: { currentPassword: ctx.messages.currentWrong } });
  }

  if (newPassword === currentPassword) {
    return fail({ fieldErrors: { newPassword: ctx.messages.sameAsCurrent } });
  }

  await ctx.savePasswordHash(user.id, await ctx.hashPassword(newPassword));
  ctx.recordSuccess(user.id);
  ctx.logEvent({ type: 'password_changed', userId: user.id, ip: ctx.ip });
  return fail({ fieldErrors: {}, success: ctx.messages.changed });
}
