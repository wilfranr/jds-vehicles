import 'server-only';

import { prisma } from '@/lib/db';

export interface AccountProfile {
  nombre: string;
  apellido: string;
  tipoDocumento: string;
  documentoIdentidad: string;
  email: string;
  telefono: string;
  ciudad: string | null;
  direccion: string | null;
}

/** Perfil del usuario indicado (el id sale de la sesión); `null` si no existe o está desactivado. */
export async function getProfile(userId: number): Promise<AccountProfile | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      activo: true,
      nombre: true,
      apellido: true,
      tipoDocumento: true,
      documentoIdentidad: true,
      email: true,
      telefono: true,
      ciudad: true,
      direccion: true,
    },
  });
  if (!user || !user.activo) return null;
  const { activo: _activo, ...profile } = user;
  return profile;
}
