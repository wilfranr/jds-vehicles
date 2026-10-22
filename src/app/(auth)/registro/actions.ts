'use server';

import bcrypt from 'bcryptjs';
import { AuthError } from 'next-auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { signIn } from '@/auth';
import { prisma } from '@/lib/db';
import { safeNextPath } from '@/lib/safe-redirect';
import { siteContent } from '@/lib/site-content';
import { createRegisterSchema, fieldErrors, rawRegisterInput } from '@/lib/validation/register';
import { BCRYPT_COST } from '@/server/auth/password';
import { registerUser } from '@/server/auth/register';
import type { RegisterFormState } from './state';

const schema = createRegisterSchema(siteContent.registro.errors);

export async function registerAction(
  _previous: RegisterFormState,
  formData: FormData
): Promise<RegisterFormState> {
  const raw = rawRegisterInput(formData);
  const values: RegisterFormState['values'] = {};
  for (const key of [
    'nombre',
    'apellido',
    'tipoDocumento',
    'documento',
    'email',
    'telefono',
    'ciudad',
    'direccion',
  ] as const) {
    const value = raw[key];
    // Se limita lo que se devuelve al navegador (entradas gigantes no se reflejan).
    if (typeof value === 'string') values[key] = value.slice(0, 300);
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      fieldErrors: fieldErrors(parsed.error),
      formError: siteContent.registro.errorSummary,
      values,
    };
  }

  const result = await registerUser(parsed.data, {
    findRoleIdByName: async (name) =>
      (await prisma.role.findUnique({ where: { nombre: name } }))?.id ?? null,
    hashPassword: (plain) => bcrypt.hash(plain, BCRYPT_COST),
    createUser: (data) => prisma.user.create({ data, select: { id: true, email: true } }),
  });

  if (!result.ok) {
    const message =
      result.reason === 'duplicate'
        ? siteContent.registro.errors.duplicate
        : siteContent.registro.errors.config;
    return { fieldErrors: {}, formError: message, values };
  }

  try {
    await signIn('credentials', {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    });
  } catch (error) {
    // La cuenta ya existe; si el inicio automático falla, se continúa sin sesión.
    if (!(error instanceof AuthError)) throw error;
  }

  redirect(safeNextPath(await nextFromReferer()));
}

/**
 * Lee `?next=` de la página desde la que se envió el formulario. Así el formulario es estático (funciona
 * sin JavaScript y sin `searchParams` en el servidor) y la redirección sigue validándose con `safeNextPath`.
 */
async function nextFromReferer(): Promise<string | undefined> {
  const referer = (await headers()).get('referer');
  if (!referer) return undefined;
  try {
    return new URL(referer).searchParams.get('next') ?? undefined;
  } catch {
    return undefined;
  }
}
