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

/** Escribe el evento como una línea JSON en la salida estándar. */
export function logSecurityEvent(event: SecurityEvent): void {
  const line = {
    ts: new Date().toISOString(),
    channel: 'security',
    type: event.type,
    ...(event.userId !== undefined ? { userId: event.userId } : {}),
    ip: event.ip,
    ...(event.detail ? { detail: event.detail.slice(0, 200) } : {}),
  };
  console.warn(JSON.stringify(line));
}
