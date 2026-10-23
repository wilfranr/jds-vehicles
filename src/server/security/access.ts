import type { Rol } from '@/types/auth';
import { CODE_PATTERN } from '@/server/reservations/code-pattern';

export type AccessDecision =
  | 'allow'
  | 'redirectLogin'
  | 'redirectAuthenticated'
  /** Acceso denegado a un área restringida: 404 y evento de auditoría. */
  | 'notFound'
  /** Ruta mal formada (p. ej. código de reserva inválido): 404 con el estado HTTP correcto, sin evento. */
  | 'invalidRoute';

const ADMIN_ROLES: readonly Rol[] = ['ADMIN', 'ASESOR'];

function isUnder(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

/**
 * Regla de acceso por ruta (función pura, probada). `rol` es `null` sin sesión.
 * - `/mi-cuenta/**`: requiere sesión; el código de `/mi-cuenta/reservas/<codigo>` debe tener formato válido.
 * - `/admin/**`: sin sesión → login; con sesión solo ADMIN/ASESOR, el resto recibe 404 para no revelar la ruta.
 * - `/login`: con sesión no tiene sentido; se redirige a `next` (o a `/`).
 * Cualquier otra ruta se permite aquí.
 */
export function decideAccess(pathname: string, rol: Rol | null): AccessDecision {
  if (pathname === '/login') return rol ? 'redirectAuthenticated' : 'allow';
  if (isUnder(pathname, '/mi-cuenta')) {
    if (!rol) return 'redirectLogin';
    // `/mi-cuenta/reservas/<codigo>`: un código mal formado responde 404 real (la página, al ir en streaming,
    // devolvería 200 con el contenido de «no encontrado»).
    const code = /^\/mi-cuenta\/reservas\/([^/]+)\/?$/.exec(pathname)?.[1];
    return code !== undefined && !CODE_PATTERN.test(code) ? 'invalidRoute' : 'allow';
  }
  if (isUnder(pathname, '/admin')) {
    if (!rol) return 'redirectLogin';
    return ADMIN_ROLES.includes(rol) ? 'allow' : 'notFound';
  }
  return 'allow';
}
