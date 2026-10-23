import { logEvent } from '@/server/log';

export type SecurityEventType =
  | 'login_failed'
  | 'login_blocked'
  | 'register_blocked'
  | 'forbidden_access'
  | 'password_changed'
  | 'password_change_failed'
  | 'password_change_blocked';

export interface SecurityEvent {
  type: SecurityEventType;
  userId?: number;
  ip: string;
  /** Contexto no sensible (ruta, motivo). Nunca contraseñas, hashes ni correos completos. */
  detail?: string;
}

/** `ana.perez@dominio.com` → `a***@dominio.com`. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at < 1) return '***';
  return `${email[0]}***${email.slice(at)}`;
}

/** Escribe el evento de seguridad como una línea JSON (canal `security`, nivel `warn`). */
export function logSecurityEvent(event: SecurityEvent): void {
  logEvent({
    channel: 'security',
    level: 'warn',
    type: event.type,
    ...(event.userId !== undefined ? { userId: event.userId } : {}),
    ip: event.ip,
    ...(event.detail ? { detail: event.detail.slice(0, 200) } : {}),
  });
}
