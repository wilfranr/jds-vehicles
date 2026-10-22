import 'server-only';

import { cache } from 'react';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { isRol, type AuthUser, type Rol } from '@/types/auth';
import { buildLoginUrl } from './next-path';

/** Usuario de la sesión (según el JWT) o `null`. Lee cookies: úsese tras un `<Suspense>`. */
export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  const session = await auth();
  const user = session?.user;
  const id = Number(user?.id);
  if (!user || !Number.isSafeInteger(id) || id <= 0 || !isRol(user.rol) || !user.email) return null;
  return { id, rol: user.rol, name: user.name ?? '', email: user.email };
});

/**
 * Exige sesión; si no la hay redirige a `/login?next=<nextPath>`.
 * `nextPath` es la ruta a la que volver tras iniciar sesión (los componentes de servidor no
 * conocen su propia ruta, por eso se pasa explícita).
 */
export async function requireUser(nextPath = '/'): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) redirect(buildLoginUrl(nextPath));
  return user;
}

/**
 * Exige sesión y que el rol esté entre los permitidos.
 * Si el rol no corresponde responde `notFound()` (404) en lugar de `forbidden()`: `forbidden()` es
 * experimental (requiere `authInterrupts`) y el 404 no revela que existen áreas restringidas.
 */
export async function requireRole(roles: Rol[], nextPath = '/'): Promise<AuthUser> {
  const user = await requireUser(nextPath);
  if (!roles.includes(user.rol)) notFound();
  return user;
}

/**
 * Como `getCurrentUser` pero consulta la base de datos: devuelve `null` si el usuario fue
 * desactivado o eliminado, y el rol vigente (no el del JWT). Para operaciones sensibles (Fases 3 y 4).
 */
export async function getFreshUser(): Promise<AuthUser | null> {
  const current = await getCurrentUser();
  if (!current) return null;

  const record = await prisma.user.findUnique({
    where: { id: current.id },
    include: { rol: true },
  });
  if (!record || !record.activo || !isRol(record.rol.nombre)) return null;

  return {
    id: record.id,
    rol: record.rol.nombre,
    name: `${record.nombre} ${record.apellido}`.trim(),
    email: record.email,
  };
}
