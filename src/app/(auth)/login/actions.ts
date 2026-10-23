'use server';

import { AuthError } from 'next-auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { signIn } from '@/auth';
import { safeNextPath } from '@/lib/safe-redirect';
import { siteContent } from '@/lib/site-content';
import { nextFromReferer } from '@/server/auth/referer-next';
import { submitLogin, type LoginFormState } from '@/server/auth/submit-login';
import { logSecurityEvent } from '@/server/security/audit';
import { getClientIp } from '@/server/security/client-ip';
import {
  checkLoginAllowed,
  recordLoginFailure,
  recordLoginSuccess,
} from '@/server/security/limiters';

export async function loginAction(
  _previous: LoginFormState,
  formData: FormData
): Promise<LoginFormState> {
  const requestHeaders = await headers();

  const result = await submitLogin(formData, {
    ip: getClientIp(requestHeaders),
    messages: {
      invalidCredentials: siteContent.auth.invalidCredentials,
      tooManyAttempts: siteContent.auth.tooManyAttempts,
    },
    checkAllowed: checkLoginAllowed,
    recordFailure: recordLoginFailure,
    recordSuccess: recordLoginSuccess,
    logEvent: logSecurityEvent,
    authenticate: async (email, password) => {
      try {
        await signIn('credentials', { email, password, redirect: false });
        return true;
      } catch (error) {
        // Credenciales inválidas (CredentialsSignin) u otro error de Auth.js: mismo resultado genérico.
        if (error instanceof AuthError) return false;
        throw error;
      }
    },
  });

  if (result.status === 'state') return result.state;
  redirect(safeNextPath(nextFromReferer(requestHeaders.get('referer'))));
}
