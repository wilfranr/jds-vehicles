'use server';

import bcrypt from 'bcryptjs';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { signOut } from '@/auth';
import { prisma } from '@/lib/db';
import { siteContent } from '@/lib/site-content';
import { createChangePasswordSchema } from '@/lib/validation/account';
import {
  submitChangePassword,
  type ChangePasswordFormState,
} from '@/server/account/change-password';
import { getFreshUser } from '@/server/auth';
import { BCRYPT_COST } from '@/server/auth/password';
import { logSecurityEvent } from '@/server/security/audit';
import { getClientIp } from '@/server/security/client-ip';
import {
  checkPasswordChangeAllowed,
  recordPasswordChangeFailure,
  recordPasswordChangeSuccess,
} from '@/server/security/limiters';

const copy = siteContent.cuenta.security;
const schema = createChangePasswordSchema({
  currentRequired: copy.errors.currentRequired,
  password: siteContent.registro.errors,
});

export async function changePasswordAction(
  _previous: ChangePasswordFormState,
  formData: FormData
): Promise<ChangePasswordFormState> {
  const requestHeaders = await headers();

  const result = await submitChangePassword(formData, {
    ip: getClientIp(requestHeaders),
    schema,
    messages: {
      errorSummary: copy.errorSummary,
      currentWrong: copy.errors.currentWrong,
      sameAsCurrent: copy.errors.sameAsCurrent,
      tooManyAttempts: siteContent.auth.tooManyAttempts,
      changed: copy.changed,
    },
    getFreshUser,
    checkAllowed: checkPasswordChangeAllowed,
    recordFailure: recordPasswordChangeFailure,
    recordSuccess: recordPasswordChangeSuccess,
    logEvent: logSecurityEvent,
    getPasswordHash: async (userId) =>
      (await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } }))
        ?.passwordHash ?? null,
    comparePassword: (plain, hash) => bcrypt.compare(plain, hash),
    hashPassword: (plain) => bcrypt.hash(plain, BCRYPT_COST),
    savePasswordHash: async (userId, passwordHash) => {
      await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    },
  });

  if (result.status === 'inactive') {
    await signOut({ redirectTo: '/login' });
    redirect('/login');
  }
  return result.state;
}
