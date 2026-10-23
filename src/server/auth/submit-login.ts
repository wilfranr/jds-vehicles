import type { RateLimitResult } from '@/server/security/rate-limit';
import { maskEmail, type SecurityEvent } from '@/server/security/audit';

export interface LoginFormState {
  formError?: string;
  /** Solo el correo se conserva; nunca la contraseña. */
  values: { email?: string };
}

export const initialLoginState: LoginFormState = { values: {} };

export interface SubmitLoginContext {
  ip: string;
  messages: { invalidCredentials: string; tooManyAttempts: string };
  checkAllowed: (email: string, ip: string) => RateLimitResult;
  recordFailure: (email: string, ip: string) => void;
  recordSuccess: (email: string, ip: string) => void;
  logEvent: (event: SecurityEvent) => void;
  /** Verifica las credenciales e inicia la sesión; `true` si fue correcto. */
  authenticate: (email: string, password: string) => Promise<boolean>;
}

export type SubmitLoginResult =
  { status: 'state'; state: LoginFormState } | { status: 'authenticated' };

const MAX_EMAIL_LENGTH = 150;

function text(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value : '';
}

/**
 * Procesa un envío del formulario de login. Orden obligatorio, probado:
 * límite de intentos → verificación de la contraseña → registro del resultado.
 * Un par correo+IP bloqueado se rechaza aunque la contraseña sea correcta, y el mensaje es el mismo
 * para correo inexistente, contraseña errónea y usuario inactivo.
 */
export async function submitLogin(
  formData: FormData,
  ctx: SubmitLoginContext
): Promise<SubmitLoginResult> {
  // La clave del limitador se acota para que entradas gigantes no inflen la memoria.
  const email = text(formData.get('email')).trim().toLowerCase().slice(0, MAX_EMAIL_LENGTH);
  const password = text(formData.get('password'));
  const values = { email: text(formData.get('email')).slice(0, 300) };

  if (!ctx.checkAllowed(email, ctx.ip).allowed) {
    ctx.logEvent({ type: 'login_blocked', ip: ctx.ip, detail: maskEmail(email) });
    return {
      status: 'state',
      state: { formError: ctx.messages.tooManyAttempts, values },
    };
  }

  const ok = await ctx.authenticate(email, password);
  if (!ok) {
    ctx.recordFailure(email, ctx.ip);
    ctx.logEvent({ type: 'login_failed', ip: ctx.ip, detail: maskEmail(email) });
    return {
      status: 'state',
      state: { formError: ctx.messages.invalidCredentials, values },
    };
  }

  ctx.recordSuccess(email, ctx.ip);
  return { status: 'authenticated' };
}
