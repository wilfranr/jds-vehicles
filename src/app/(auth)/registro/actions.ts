'use server';

import bcrypt from 'bcryptjs';
import { AuthError } from 'next-auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { signIn } from '@/auth';
import { prisma } from '@/lib/db';
import { safeNextPath } from '@/lib/safe-redirect';
import { siteContent } from '@/lib/site-content';
import { createRegisterSchema } from '@/lib/validation/register';
import { BCRYPT_COST } from '@/server/auth/password';
import { submitRegistration } from '@/server/auth/submit-registration';
import { logSecurityEvent } from '@/server/security/audit';
import { getClientIp } from '@/server/security/client-ip';
import { checkRegisterAllowed, recordRegisterAttempt } from '@/server/security/limiters';
import type { RegisterFormState } from './state';

const schema = createRegisterSchema(siteContent.registro.errors);

export async function registerAction(
  _previous: RegisterFormState,
  formData: FormData
): Promise<RegisterFormState> {
  const requestHeaders = await headers();

  const result = await submitRegistration(formData, {
    ip: getClientIp(requestHeaders),
    schema,
    messages: {
      errorSummary: siteContent.registro.errorSummary,
      duplicate: siteContent.registro.errors.duplicate,
      config: siteContent.registro.errors.config,
      tooManyAttempts: siteContent.auth.tooManyAttempts,
    },
    checkAllowed: checkRegisterAllowed,
    recordAttempt: recordRegisterAttempt,
    logEvent: logSecurityEvent,
    register: {
      findRoleIdByName: async (name) =>
        (await prisma.role.findUnique({ where: { nombre: name } }))?.id ?? null,
      hashPassword: (plain) => bcrypt.hash(plain, BCRYPT_COST),
      createUser: (data) => prisma.user.create({ data, select: { id: true, email: true } }),
    },
    signIn: async (email, password) => {
      try {
        await signIn('credentials', { email, password, redirect: false });
      } catch (error) {
        // La cuenta ya existe; si el inicio automático falla, se continúa sin sesión.
        if (!(error instanceof AuthError)) throw error;
      }
    },
  });

  if (result.status === 'state') return result.state;
  redirect(safeNextPath(nextFromReferer(requestHeaders.get('referer'))));
}

/**
 * Lee `?next=` de la página desde la que se envió el formulario. Así el formulario es estático (funciona
 * sin JavaScript y sin `searchParams` en el servidor) y la redirección sigue validándose con `safeNextPath`.
 */
function nextFromReferer(referer: string | null): string | undefined {
  if (!referer) return undefined;
  try {
    return new URL(referer).searchParams.get('next') ?? undefined;
  } catch {
    return undefined;
  }
}
