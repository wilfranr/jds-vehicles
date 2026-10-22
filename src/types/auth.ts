export const ROLES = ['CLIENTE', 'ADMIN', 'ASESOR'] as const;

/** Nombre del rol (`roles.nombre`), no el id numérico. */
export type Rol = (typeof ROLES)[number];

export function isRol(value: unknown): value is Rol {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

/** Usuario autenticado tal como viaja en el token y la sesión: sin datos sensibles. */
export interface AuthUser {
  id: number;
  rol: Rol;
  name: string;
  email: string;
}
