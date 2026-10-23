import bcrypt from 'bcryptjs';
import { Prisma, type PrismaClient } from '@prisma/client';
import { siteContent } from '../../lib/site-content';
import { createRegisterSchema, fieldErrors } from '../../lib/validation/register';
import { BCRYPT_COST } from '../auth/password';
import { logEvent } from '../log';

/** Datos del primer administrador (los mismos campos obligatorios del registro, con las mismas reglas de F2-02). */
export interface FirstAdminInput {
  nombre: string;
  apellido: string;
  tipoDocumento: string;
  documento: string;
  email: string;
  telefono: string;
  password: string;
}

export type FirstAdminResult =
  | { status: 'ok'; id: number }
  /** Ya existe al menos un usuario con rol ADMIN (activo o no): no se crea otro desde este comando. */
  | { status: 'exists' }
  | { status: 'invalid'; fieldErrors: Record<string, string> }
  /** Faltan los roles: hay que ejecutar `pnpm db:seed` (solo datos de referencia) antes. */
  | { status: 'roles_missing' }
  /** El correo o el documento ya pertenecen a otro usuario. */
  | { status: 'duplicate' };

const schema = createRegisterSchema(siteContent.registro.errors);

/**
 * Crea el primer ADMIN de una base de datos sin usuarios demo (F5-03). Aplica la política de contraseña de
 * F2-02 y bcrypt de coste 12, y se niega si ya existe un ADMIN: la comprobación y el alta van en una transacción
 * con el rol ADMIN bloqueado (`FOR UPDATE`), de modo que dos ejecuciones simultáneas no crean dos. Registra el
 * evento (solo el id) y nunca la contraseña.
 */
export async function createFirstAdmin(
  prisma: PrismaClient,
  input: FirstAdminInput,
  options: { hash?: (plain: string) => Promise<string> } = {}
): Promise<FirstAdminResult> {
  const parsed = schema.safeParse({
    ...input,
    confirmPassword: input.password,
    ciudad: undefined,
    direccion: undefined,
    consentimiento: 'on',
  });
  if (!parsed.success) return { status: 'invalid', fieldErrors: fieldErrors(parsed.error) };
  const data = parsed.data;

  const passwordHash = await (options.hash ?? ((plain) => bcrypt.hash(plain, BCRYPT_COST)))(
    data.password
  );

  try {
    const result = await prisma.$transaction(async (tx): Promise<FirstAdminResult> => {
      const roles = await tx.$queryRaw<
        { id: number }[]
      >`SELECT id FROM roles WHERE nombre = 'ADMIN' FOR UPDATE`;
      if (roles.length === 0) return { status: 'roles_missing' };
      const roleId = Number(roles[0]!.id);

      if ((await tx.user.count({ where: { rolId: roleId } })) > 0) return { status: 'exists' };

      const user = await tx.user.create({
        data: {
          rolId: roleId,
          nombre: data.nombre,
          apellido: data.apellido,
          tipoDocumento: data.tipoDocumento,
          documentoIdentidad: data.documento,
          email: data.email,
          passwordHash,
          telefono: data.telefono,
          consentimientoDatosAt: new Date(),
        },
        select: { id: true },
      });
      return { status: 'ok', id: user.id };
    });

    if (result.status === 'ok') {
      logEvent({ channel: 'admin', event: 'first_admin_created', userId: result.id });
    }
    return result;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { status: 'duplicate' };
    }
    throw error;
  }
}
