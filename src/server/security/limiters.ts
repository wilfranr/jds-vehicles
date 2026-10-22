import { createRateLimiter, type RateLimitResult } from './rate-limit';

const MINUTE = 60_000;

/** Fallos de login por combinación correo+IP: 5 en 15 minutos. */
const loginPair = createRateLimiter({ limit: 5, windowMs: 15 * MINUTE });
/** Fallos de login por IP: 20 en 15 minutos. */
const loginIp = createRateLimiter({ limit: 20, windowMs: 15 * MINUTE });
/** Registros por IP: 5 por hora. */
const register = createRateLimiter({ limit: 5, windowMs: 60 * MINUTE });

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
