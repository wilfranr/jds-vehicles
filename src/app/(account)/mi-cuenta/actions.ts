'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { signOut } from '@/auth';
import { prisma } from '@/lib/db';
import { siteContent } from '@/lib/site-content';
import { createProfileSchema } from '@/lib/validation/register';
import { getFreshUser } from '@/server/auth';
import { submitProfileUpdate, type ProfileFormState } from '@/server/account/update-profile';

const schema = createProfileSchema(siteContent.registro.errors);

export async function updateProfileAction(
  _previous: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const result = await submitProfileUpdate(formData, {
    schema,
    messages: {
      errorSummary: siteContent.registro.errorSummary,
      saved: siteContent.cuenta.profile.saved,
    },
    getFreshUser,
    updateProfile: async (userId, data) => {
      await prisma.user.update({
        where: { id: userId },
        data: {
          nombre: data.nombre,
          apellido: data.apellido,
          telefono: data.telefono,
          ciudad: data.ciudad ?? null,
          direccion: data.direccion ?? null,
        },
      });
    },
  });

  if (result.status === 'inactive') {
    // Cuenta desactivada tras iniciar sesión: se cierra la sesión.
    await signOut({ redirectTo: '/login' });
    redirect('/login');
  }
  revalidatePath('/mi-cuenta');
  return result.state;
}
