'use client';

import React, { useActionState } from 'react';
import Link from 'next/link';
import { reserveVehicleAction } from '@/app/(public)/vehiculos/[id]/actions';
import { siteContent } from '@/lib/site-content';
import { initialReserveState } from '@/server/reservations/submit-reservation';

const copy = siteContent.vehicleDetail;

/** Botón principal de reserva: un `<form>` con Server Action (el id del usuario nunca viaja en el formulario). */
export function ReserveForm({ vehicleId }: { vehicleId: number }) {
  const [state, formAction, pending] = useActionState(reserveVehicleAction, initialReserveState);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="vehicleId" value={vehicleId} />
      <button
        type="submit"
        disabled={pending}
        className="bg-secondary text-on-secondary font-label-lg hover:bg-on-secondary-fixed-variant focus-visible:ring-secondary flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-base font-bold shadow-md transition-all focus-visible:ring-2 focus-visible:outline-none active:scale-[0.99] disabled:opacity-60"
      >
        {pending ? copy.reserveSubmitting : copy.reserveCta}
      </button>
      {state.error && (
        <div
          role="alert"
          className="bg-error-container text-on-error-container rounded-lg px-4 py-3 text-sm"
        >
          <p>{state.error}</p>
          {state.showReservationsLink && (
            <Link
              href="/mi-cuenta/reservas"
              className="mt-1 inline-block font-semibold underline underline-offset-2"
            >
              {siteContent.reservations.errors.limitReachedLink}
            </Link>
          )}
        </div>
      )}
    </form>
  );
}
