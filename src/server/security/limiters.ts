import { createRateLimiter, type RateLimitResult } from './rate-limit';

const MINUTE = 60_000;

/** Fallos de login por combinación correo+IP: 5 en 15 minutos. */
const loginPair = createRateLimiter({ limit: 5, windowMs: 15 * MINUTE });
/** Fallos de login por IP: 20 en 15 minutos. */
const loginIp = createRateLimiter({ limit: 20, windowMs: 15 * MINUTE });
/** Registros por IP: 5 por hora. */
const register = createRateLimiter({ limit: 5, windowMs: 60 * MINUTE });

/** Fallos de contraseña actual al cambiarla, por usuario: 5 en 15 minutos. */
const passwordChange = createRateLimiter({ limit: 5, windowMs: 15 * MINUTE });

/** Intentos de reserva por usuario: 10 por hora (válidos o no). */
const reserve = createRateLimiter({ limit: 10, windowMs: 60 * MINUTE });

/** Restablecimientos de contraseña hechos por un administrador: 10 por hora por administrador. */
const adminPasswordReset = createRateLimiter({ limit: 10, windowMs: 60 * MINUTE });

function pairKey(email: string, ip: string): string {
  return `${email.trim().toLowerCase()}|${ip}`;
}

function blocked(...results: RateLimitResult[]): RateLimitResult {
  const denied = results.filter((r) => !r.allowed);
  if (denied.length === 0) return { allowed: true, retryAfterSeconds: 0 };
  return { allowed: false, retryAfterSeconds: Math.max(...denied.map((r) => r.retryAfterSeconds)) };
}

/** Debe consultarse ANTES de verificar la contraseña: un par bloqueado se rechaza aunque la clave sea correcta. */
export function checkLoginAllowed(email: string, ip: string): RateLimitResult {
  return blocked(loginPair.check(pairKey(email, ip)), loginIp.check(ip));
}

export function recordLoginFailure(email: string, ip: string): void {
  loginPair.hit(pairKey(email, ip));
  loginIp.hit(ip);
}

/** Un login correcto reinicia solo el contador del par correo+IP, no el de la IP. */
export function recordLoginSuccess(email: string, ip: string): void {
  loginPair.reset(pairKey(email, ip));
}

export function checkRegisterAllowed(ip: string): RateLimitResult {
  return register.check(ip);
}

/** Cada intento de registro (válido o no) consume cupo de la IP. */
export function recordRegisterAttempt(ip: string): void {
  register.hit(ip);
}

export function checkPasswordChangeAllowed(userId: number): RateLimitResult {
  return passwordChange.check(String(userId));
}

export function recordPasswordChangeFailure(userId: number): void {
  passwordChange.hit(String(userId));
}

export function recordPasswordChangeSuccess(userId: number): void {
  passwordChange.reset(String(userId));
}

export function checkReserveAllowed(userId: number): RateLimitResult {
  return reserve.check(String(userId));
}

/** Cada intento de reserva consume cupo del usuario. */
export function recordReserveAttempt(userId: number): void {
  reserve.hit(String(userId));
}

export function checkAdminResetAllowed(actorId: number): RateLimitResult {
  return adminPasswordReset.check(String(actorId));
}

/** Cada restablecimiento (permitido) consume cupo del administrador. */
export function recordAdminReset(actorId: number): void {
  adminPasswordReset.hit(String(actorId));
}
