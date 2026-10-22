import type { Rol } from '@/types/auth';

export type AccessDecision = 'allow' | 'redirectLogin' | 'notFound';

const ADMIN_ROLES: readonly Rol[] = ['ADMIN', 'ASESOR'];

function isUnder(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

/**
 * Regla de acceso por ruta (función pura, probada). `rol` es `null` sin sesión.
 * - `/mi-cuenta/**`: requiere sesión.
 * - `/admin/**`: sin sesión → login; con sesión solo ADMIN/ASESOR, el resto recibe 404 para no revelar la ruta.
 * Cualquier otra ruta se permite aquí.
 */
export function decideAccess(pathname: string, rol: Rol | null): AccessDecision {
  if (isUnder(pathname, '/mi-cuenta')) return rol ? 'allow' : 'redirectLogin';
  if (isUnder(pathname, '/admin')) {
    if (!rol) return 'redirectLogin';
    return ADMIN_ROLES.includes(rol) ? 'allow' : 'notFound';
  }
  return 'allow';
}
