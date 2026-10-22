import type { ZodType } from 'zod';
import { fieldErrors, rawRegisterInput, type RegisterInput } from '@/lib/validation/register';
import type { RegisterFormState } from '@/app/(auth)/registro/state';
import type { RateLimitResult } from '@/server/security/rate-limit';
import type { SecurityEvent } from '@/server/security/audit';
import { registerUser, type RegisterDeps } from './register';

export interface SubmitRegistrationMessages {
  errorSummary: string;
  duplicate: string;
  config: string;
  tooManyAttempts: string;
}

export interface SubmitRegistrationContext {
  ip: string;
  schema: ZodType<RegisterInput>;
  messages: SubmitRegistrationMessages;
  checkAllowed: (ip: string) => RateLimitResult;
  recordAttempt: (ip: string) => void;
  logEvent: (event: SecurityEvent) => void;
  register: RegisterDeps;
  /** Inicia sesión tras el alta; los fallos no deben impedir la redirección. */
  signIn: (email: string, password: string) => Promise<void>;
}

export type SubmitRegistrationResult =
  { status: 'state'; state: RegisterFormState } | { status: 'registered' };

const PRESERVED_FIELDS = [
  'nombre',
  'apellido',
  'tipoDocumento',
  'documento',
  'email',
  'telefono',
  'ciudad',
  'direccion',
] as const;

/**
 * Procesa un envío del formulario de registro. Orden obligatorio, probado:
 * límite de intentos → validación → hash → creación → inicio de sesión.
 * Un envío bloqueado no ejecuta bcrypt ni toca la base de datos.
 */
export async function submitRegistration(
  formData: FormData,
  ctx: SubmitRegistrationContext
): Promise<SubmitRegistrationResult> {
  const raw = rawRegisterInput(formData);
  const values: RegisterFormState['values'] = {};
  for (const key of PRESERVED_FIELDS) {
    const value = raw[key];
    // Se limita lo que se devuelve al navegador (entradas gigantes no se reflejan).
    if (typeof value === 'string') values[key] = value.slice(0, 300);
  }

  if (!ctx.checkAllowed(ctx.ip).allowed) {
    ctx.logEvent({ type: 'register_blocked', ip: ctx.ip });
    return {
      status: 'state',
      state: { fieldErrors: {}, formError: ctx.messages.tooManyAttempts, values },
    };
  }
  // Todo envío que pasa el chequeo consume cupo, sea válido, inválido o duplicado.
  ctx.recordAttempt(ctx.ip);

  const parsed = ctx.schema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: 'state',
      state: {
        fieldErrors: fieldErrors(parsed.error),
        formError: ctx.messages.errorSummary,
        values,
      },
    };
  }

  const result = await registerUser(parsed.data, ctx.register);
  if (!result.ok) {
    const formError = result.reason === 'duplicate' ? ctx.messages.duplicate : ctx.messages.config;
    return { status: 'state', state: { fieldErrors: {}, formError, values } };
  }

  await ctx.signIn(parsed.data.email, parsed.data.password);
  return { status: 'registered' };
}
