import React from 'react';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ReservationStatusChip } from '@/components/account/ReservationStatusChip';
import { WhatsAppIcon } from '@/components/ui/BrandIcons';
import { formatDateTime } from '@/lib/format';
import { siteContent } from '@/lib/site-content';
import { buildReservationWhatsAppUrl } from '@/lib/whatsapp';
import { requireUser } from '@/server/auth';
import { getDealerConfig } from '@/server/config';
import { parseReservationCode } from '@/server/reservations/code';
import { getUserReservationByCode } from '@/server/reservations/queries';
import { isLocalMedia, thumbOf } from '@/lib/media-url';

const copy = siteContent.cuenta.reservations;
const ACTIVE = ['PENDIENTE_CONTACTO', 'EN_NEGOCIACION'];

export const metadata: Metadata = { title: copy.detailTitle };

export default async function ReservationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ codigo: string }>;
  searchParams: Promise<{ nueva?: string | string[] }>;
}) {
  const { codigo: rawCode } = await params;
  // Código mal formado: 404 sin tocar la BD.
  const codigo = parseReservationCode(rawCode);
  if (!codigo) notFound();

  const user = await requireUser(`/mi-cuenta/reservas/${codigo}`);
  // Autorización por propiedad: un código ajeno es indistinguible de uno inexistente.
  const reservation = await getUserReservationByCode(user.id, codigo);
  if (!reservation) notFound();

  const { nueva } = await searchParams;
  const isNew = (Array.isArray(nueva) ? nueva[0] : nueva) === '1';
  const { vehiculo } = reservation;
  const title = `${vehiculo.marca} ${vehiculo.modelo} ${vehiculo.anio}`;

  // El enlace se reconstruye con el número vigente del concesionario (no se usa el guardado).
  const whatsappUrl = ACTIVE.includes(reservation.estado)
    ? buildReservationWhatsAppUrl((await getDealerConfig()).whatsappNumber, {
        marca: vehiculo.marca,
        modelo: vehiculo.modelo,
        codigo: reservation.codigo,
        nombre: user.name,
      })
    : null;

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/mi-cuenta/reservas"
        className="text-secondary font-label-md focus-visible:ring-primary self-start text-sm font-semibold hover:underline focus-visible:ring-2 focus-visible:outline-none"
      >
        {copy.backToList}
      </Link>

      {isNew && (
        <div
          role="status"
          className="bg-status-nuevo-bg text-status-nuevo border-status-nuevo-border rounded-2xl border p-4"
        >
          <p className="font-headline-sm text-lg font-bold">{copy.newTitle}</p>
          <p className="mt-1 text-sm">
            {copy.newDescription}{' '}
            <strong className="font-spec-numerical text-base">{reservation.codigo}</strong>
          </p>
        </div>
      )}

      <section
        aria-labelledby="reserva-titulo"
        className="bg-surface-container-lowest border-outline-variant/30 flex flex-col gap-4 rounded-2xl border p-4 shadow-sm sm:p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="reserva-titulo" className="font-headline-sm text-on-surface text-xl font-bold">
            {title}
          </h2>
          <ReservationStatusChip estado={reservation.estado} />
        </div>

        <div className="bg-surface-container relative aspect-[16/10] w-full max-w-md overflow-hidden rounded-xl">
          {vehiculo.fotoUrl ? (
            <Image
              src={thumbOf(vehiculo.fotoUrl)}
              unoptimized={isLocalMedia(vehiculo.fotoUrl)}
              alt={title}
              fill
              sizes="(max-width: 640px) 100vw, 448px"
              className="object-cover"
            />
          ) : (
            <div className="text-on-surface-variant flex h-full items-center justify-center text-sm">
              {copy.noPhoto}
            </div>
          )}
        </div>

        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-on-surface-variant">{copy.codeLabel}</dt>
            <dd className="text-on-surface font-spec-numerical font-semibold">
              {reservation.codigo}
            </dd>
          </div>
          <div>
            <dt className="text-on-surface-variant">{copy.vehicleHeading}</dt>
            <dd className="text-on-surface font-semibold">
              {title} · {vehiculo.color}
            </dd>
          </div>
          <div>
            <dt className="text-on-surface-variant">{copy.dateLabel}</dt>
            <dd className="text-on-surface font-semibold">
              {formatDateTime(reservation.fechaReserva)}
            </dd>
          </div>
          {reservation.fechaExpiracion && (
            <div>
              <dt className="text-on-surface-variant">{copy.expiresLabel}</dt>
              <dd className="text-on-surface font-semibold">
                {formatDateTime(reservation.fechaExpiracion)}
              </dd>
            </div>
          )}
        </dl>

        {whatsappUrl && (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-label-lg flex w-full items-center justify-center gap-2 rounded-xl bg-[#0e7c42] px-6 py-4 text-base font-bold text-white shadow-sm transition-all hover:bg-[#0b6a38] focus-visible:ring-2 focus-visible:ring-[#25D366] focus-visible:ring-offset-2 focus-visible:outline-none sm:w-auto sm:self-start"
          >
            <WhatsAppIcon className="h-5 w-5 shrink-0 fill-white" />
            <span>{copy.whatsappCta}</span>
          </a>
        )}

        <Link
          href={`/vehiculos/${vehiculo.id}`}
          className="text-secondary font-label-md focus-visible:ring-primary self-start text-sm font-semibold hover:underline focus-visible:ring-2 focus-visible:outline-none"
        >
          {copy.viewVehicle}
        </Link>
      </section>
    </div>
  );
}
