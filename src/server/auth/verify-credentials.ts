import { z } from 'zod';
import { isRol, type AuthUser } from '@/types/auth';

/** bcrypt solo considera los primeros 72 bytes; se rechazan entradas mayores para no truncar en silencio. */
const MAX_PASSWORD_BYTES = 72;

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().max(150).pipe(z.email()),
  password: z
    .string()
    .min(1)
    .refine((value) => Buffer.byteLength(value, 'utf8') <= MAX_PASSWORD_BYTES),
});

/**
 * Hash bcrypt (coste 10) de una contraseña aleatoria descartada. Se compara contra él cuando
 * el usuario no existe para igualar el tiempo de respuesta y evitar enumerar correos.
 */
export const DUMMY_PASSWORD_HASH = '$2b$10$jqjahToDDFppUgO4tCXG.OHZCr0ZK9kanJIv0IQ7F0FYqa5HbFJ6a';

/** Registro mínimo que necesita la verificación (subconjunto de `User` con su rol). */
export interface CredentialsUserRecord {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
  passwordHash: string;
  activo: boolean;
  rol: { nombre: string };
}

export interface VerifyCredentialsDeps {
  findUserByEmail: (email: string) => Promise<CredentialsUserRecord | null>;
  comparePassword: (plain: string, hash: string) => Promise<boolean>;
}

/**
 * Valida correo y contraseña. Devuelve el usuario público o `null`; nunca lanza por entrada
 * inválida ni distingue correo inexistente, contraseña errónea o usuario inactivo.
 */
export async function verifyCredentials(
  email: unknown,
  password: unknown,
  deps: VerifyCredentialsDeps
): Promise<AuthUser | null> {
  const parsed = credentialsSchema.safeParse({ email, password });
  if (!parsed.success) return null;

  const user = await deps.findUserByEmail(parsed.data.email);

  // Siempre se ejecuta una comparación, exista o no el usuario.
  const passwordMatches = await deps.comparePassword(
    parsed.data.password,
    user?.passwordHash ?? DUMMY_PASSWORD_HASH
  );

  if (!user || !passwordMatches || !user.activo) return null;
  if (!isRol(user.rol.nombre)) return null;

  return {
    id: user.id,
    rol: user.rol.nombre,
    name: `${user.nombre} ${user.apellido}`.trim(),
    email: user.email,
  };
}
