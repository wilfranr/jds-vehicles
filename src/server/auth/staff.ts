import 'server-only';

import { notFound } from 'next/navigation';
import type { AuthUser, Rol } from '@/types/auth';
import { getFreshUser, requireRole } from './index';

export const STAFF_ROLES: Rol[] = ['ADMIN', 'ASESOR'];
export const ADMIN_ONLY: Rol[] = ['ADMIN'];

/**
 * Exige un rol permitido en la sesión y lo **confirma en la base de datos** (usuario activo y rol vigente):
 * el JWT dura hasta 7 días y no se revoca si se desactiva a la persona o se le cambia el rol, y el panel
 * maneja datos de clientes. Sin sesión redirige a login; con un rol insuficiente (o cuenta desactivada)
 * responde 404 para no revelar que el área existe.
 */
async function requireFreshRole(roles: Rol[], nextPath: string): Promise<AuthUser> {
  await requireRole(roles, nextPath);
  const fresh = await getFreshUser();
  if (!fresh || !roles.includes(fresh.rol)) notFound();
  return fresh;
}

/** `ADMIN` o `ASESOR`. Cada página y cada Server Action del panel debe llamarla (además del proxy). */
export function requireStaff(nextPath = '/admin'): Promise<AuthUser> {
  return requireFreshRole(STAFF_ROLES, nextPath);
}

/** Solo `ADMIN` (usuarios y configuración del concesionario). */
export function requireAdmin(nextPath = '/admin'): Promise<AuthUser> {
  return requireFreshRole(ADMIN_ONLY, nextPath);
}
