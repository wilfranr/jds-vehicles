import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { formatDateTime } from '@/lib/format';
import { siteContent } from '@/lib/site-content';
import type { ReservationSummary } from '@/server/reservations/queries';
import { ReservationStatusChip } from './ReservationStatusChip';
import { isLocalMedia, thumbOf } from '@/lib/media-url';

const copy = siteContent.cuenta.reservations;

export function ReservationCard({ reservation }: { reservation: ReservationSummary }) {
  const { vehiculo } = reservation;
  const title = `${vehiculo.marca} ${vehiculo.modelo} ${vehiculo.anio}`;

  return (
    <article className="bg-surface-container-lowest border-outline-variant/30 flex flex-col gap-4 rounded-2xl border p-4 shadow-sm sm:flex-row">
      <div className="bg-surface-container relative aspect-[16/10] w-full shrink-0 overflow-hidden rounded-xl sm:w-44">
        {vehiculo.fotoUrl ? (
          <Image
            src={thumbOf(vehiculo.fotoUrl)}
            unoptimized={isLocalMedia(vehiculo.fotoUrl)}
            alt={title}
            fill
            sizes="(max-width: 640px) 100vw, 176px"
            className="object-cover"
          />
        ) : (
          <div className="text-on-surface-variant flex h-full items-center justify-center text-xs">
            {copy.noPhoto}
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-headline-sm text-on-surface text-lg font-bold">{title}</h3>
          <ReservationStatusChip estado={reservation.estado} />
        </div>
        <dl className="text-on-surface-variant grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
          <div>
            <dt className="inline">{copy.codeLabel}: </dt>
            <dd className="text-on-surface font-spec-numerical inline font-semibold">
              {reservation.codigo}
            </dd>
          </div>
          <div>
            <dt className="inline">{copy.dateLabel}: </dt>
            <dd className="text-on-surface inline">{formatDateTime(reservation.fechaReserva)}</dd>
          </div>
          {reservation.fechaExpiracion && (
            <div>
              <dt className="inline">{copy.expiresLabel}: </dt>
              <dd className="text-on-surface inline">
                {formatDateTime(reservation.fechaExpiracion)}
              </dd>
            </div>
          )}
        </dl>
        <Link
          href={`/mi-cuenta/reservas/${reservation.codigo}`}
          aria-label={`${copy.viewDetail}: ${title}, ${reservation.codigo}`}
          className="bg-primary text-on-primary font-label-md focus-visible:ring-primary mt-auto self-start rounded-lg px-4 py-2 text-sm transition-colors hover:bg-neutral-800 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          {copy.viewDetail}
        </Link>
      </div>
    </article>
  );
}
