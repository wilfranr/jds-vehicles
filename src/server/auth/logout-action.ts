'use server';

import { signOut } from '@/auth';

/** Cierra la sesión (POST mediante Server Action, nunca un enlace GET) y vuelve a la portada. */
export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: '/' });
}
