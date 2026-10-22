import type { RegisterInput } from '@/lib/validation/register';

export const CLIENT_ROLE_NAME = 'CLIENTE';

export interface NewUserData {
  rolId: number;
  nombre: string;
  apellido: string;
  tipoDocumento: RegisterInput['tipoDocumento'];
  documentoIdentidad: string;
  email: string;
  passwordHash: string;
  telefono: string;
  direccion: string | null;
  ciudad: string | null;
  consentimientoDatosAt: Date;
}

export interface RegisterDeps {
  findRoleIdByName: (name: string) => Promise<number | null>;
  hashPassword: (plain: string) => Promise<string>;
  /** Debe lanzar el error de unicidad de Prisma (`P2002`) si el correo o documento ya existen. */
  createUser: (data: NewUserData) => Promise<{ id: number; email: string }>;
  now?: () => Date;
}

export type RegisterResult =
  { ok: true; user: { id: number; email: string } } | { ok: false; reason: 'duplicate' | 'config' };

export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

/**
 * Crea un cliente ya validado. No consulta duplicados de antemano: confía en las restricciones
 * únicas de la BD (sin condiciones de carrera) y devuelve un resultado genérico `duplicate`.
 * No registra contraseñas ni hashes.
 */
export async function registerUser(
  input: RegisterInput,
  deps: RegisterDeps
): Promise<RegisterResult> {
  const rolId = await deps.findRoleIdByName(CLIENT_ROLE_NAME);
  if (rolId === null) return { ok: false, reason: 'config' };

  const passwordHash = await deps.hashPassword(input.password);

  try {
    const user = await deps.createUser({
      rolId,
      nombre: input.nombre,
      apellido: input.apellido,
      tipoDocumento: input.tipoDocumento,
      documentoIdentidad: input.documento,
      email: input.email,
      passwordHash,
      telefono: input.telefono,
      direccion: input.direccion ?? null,
      ciudad: input.ciudad ?? null,
      consentimientoDatosAt: (deps.now ?? (() => new Date()))(),
    });
    return { ok: true, user };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, reason: 'duplicate' };
    throw error;
  }
}
