'use server';

import { redirect } from 'next/navigation';
import { signOut } from '@/auth';
import { prisma } from '@/lib/db';
import { siteContent } from '@/lib/site-content';
import { buildReservationWhatsAppUrl } from '@/lib/whatsapp';
import { getFreshUser } from '@/server/auth';
import { getDealerConfig } from '@/server/config';
import { createReservation, invalidateCatalogFromAction } from '@/server/reservations';
import { submitReservation, type ReserveFormState } from '@/server/reservations/submit-reservation';
import { checkReserveAllowed, recordReserveAttempt } from '@/server/security/limiters';

const copy = siteContent.reservations;

export async function reserveVehicleAction(
  _previous: ReserveFormState,
  formData: FormData
): Promise<ReserveFormState> {
  const result = await submitReservation(formData, {
    messages: {
      notAvailable: copy.errors.notAvailable,
      limitReached: copy.errors.limitReached,
      invalidVehicle: copy.errors.invalidVehicle,
      tooManyAttempts: siteContent.auth.tooManyAttempts,
    },
    getFreshUser,
    checkAllowed: checkReserveAllowed,
    recordAttempt: recordReserveAttempt,
    // `updateTag` (solo en Server Actions): quien reserva ve «Reservado» al instante.
    createReservation: (input) =>
      createReservation(input, { invalidateCache: invalidateCatalogFromAction }),
    getVehicleLabel: async (vehicleId) => {
      const vehicle = await prisma.vehiculo.findUnique({
        where: { id: vehicleId },
        select: { modelo: { select: { nombre: true, marca: { select: { nombre: true } } } } },
      });
      return vehicle ? { marca: vehicle.modelo.marca.nombre, modelo: vehicle.modelo.nombre } : null;
    },
    getDealerPhone: async () => (await getDealerConfig()).whatsappNumber,
    buildWhatsAppUrl: buildReservationWhatsAppUrl,
    saveWhatsappLink: async (reservationId, url) => {
      await prisma.reserva.update({ where: { id: reservationId }, data: { whatsappLink: url } });
    },
    refreshCatalog: invalidateCatalogFromAction,
  });

  if (result.status === 'inactive') {
    // Cuenta desactivada tras iniciar sesión: se cierra la sesión.
    await signOut({ redirectTo: '/login' });
    redirect('/login');
  }
  if (result.status === 'redirect') redirect(result.to);
  return result.state;
}
