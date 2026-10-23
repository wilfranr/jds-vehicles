import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ReservationStatusChip } from '@/components/account/ReservationStatusChip';
import { NotesForm, ReservationActionsPanel } from '@/components/admin/ReservationActions';
import { WhatsAppIcon } from '@/components/ui/BrandIcons';
import { formatCOP, formatDateTime } from '@/lib/format';
import { siteContent } from '@/lib/site-content';
import { buildStaffContactUrl } from '@/lib/whatsapp';
import { getAdminReservation } from '@/server/admin/reservations';
import { requireStaff } from '@/server/auth/staff';
import { parseReservationCode } from '@/server/reservations/code';
import { checkTransition } from '@/server/reservations/transitions';
import { cancelReservationAction, saveNotesAction, startNegotiationAction } from '../actions';

const copy = siteContent.adminReservations;

export const metadata: Metadata = { title: copy.detailTitle };

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-on-surface-variant text-sm">{label}</dt>
      <dd className="text-on-surface font-semibold break-words">{children}</dd>
    </div>
  );
}

export default async function AdminReservationDetailPage({
  params,
}: {
  params: Promise<{ codigo: string }>;
}) {
  const code = parseReservationCode((await params).codigo);
  if (!code) notFound();

  await requireStaff(`/admin/reservas/${code}`);
  const reservation = await getAdminReservation(code);
  if (!reservation) notFound();

  const { cliente, vehiculo } = reservation;
  const canNegotiate = checkTransition(reservation.estado, 'EN_NEGOCIACION').ok;
  const canCancel = checkTransition(reservation.estado, 'CANCELADA').ok;
  const contactUrl = buildStaffContactUrl(cliente.telefono, {
    nombre: cliente.nombre,
    codigo: reservation.codigo,
    marca: vehiculo.marca,
    modelo: vehiculo.modelo,
  });

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Link href="/admin/reservas" className="text-secondary text-sm font-semibold hover:underline">
        {copy.backToList}
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-headline-xl text-on-surface text-3xl font-extrabold tracking-tight">
          <span className="font-spec-numerical">{reservation.codigo}</span>
        </h1>
        <ReservationStatusChip estado={reservation.estado} />
      </div>

      <section
        aria-labelledby="sec-cliente"
        className="bg-surface-container-lowest border-outline-variant/30 rounded-2xl border p-4"
      >
        <h2 id="sec-cliente" className="font-headline-sm mb-3 text-lg font-bold">
          {copy.sections.client}
        </h2>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Item label={copy.fields.name}>
            {cliente.nombre} {cliente.apellido}
          </Item>
          <Item label={copy.fields.phone}>{cliente.telefono}</Item>
          <Item label={copy.fields.email}>{cliente.email}</Item>
          <Item label={copy.fields.city}>{cliente.ciudad ?? copy.cityMissing}</Item>
          <Item label={copy.fields.document}>
            <span className="font-spec-numerical">{cliente.documentoEnmascarado}</span>
          </Item>
        </dl>
        <a
          href={contactUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-label-lg mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-[#0e7c42] px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#0b6a38] focus-visible:ring-2 focus-visible:ring-[#25D366] focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <WhatsAppIcon className="h-5 w-5 shrink-0 fill-white" />
          <span>{copy.contactClient}</span>
        </a>
      </section>

      <section
        aria-labelledby="sec-vehiculo"
        className="bg-surface-container-lowest border-outline-variant/30 rounded-2xl border p-4"
      >
        <h2 id="sec-vehiculo" className="font-headline-sm mb-3 text-lg font-bold">
          {copy.sections.vehicle}
        </h2>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Item label={copy.sections.vehicle}>
            <Link href={`/admin/vehiculos/${vehiculo.id}`} className="hover:underline">
              {vehiculo.marca} {vehiculo.modelo} {vehiculo.anio} · {vehiculo.color}
            </Link>
          </Item>
          <Item label={copy.fields.plate}>
            <span className="font-spec-numerical">{vehiculo.placa ?? copy.plateMissing}</span>
          </Item>
          <Item label={copy.fields.price}>{formatCOP(vehiculo.precio)}</Item>
        </dl>
      </section>

      <section
        aria-labelledby="sec-fechas"
        className="bg-surface-container-lowest border-outline-variant/30 rounded-2xl border p-4"
      >
        <h2 id="sec-fechas" className="font-headline-sm mb-3 text-lg font-bold">
          {copy.sections.dates}
        </h2>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Item label={copy.fields.reservedAt}>{formatDateTime(reservation.fechaReserva)}</Item>
          <Item label={copy.fields.expiresAt}>
            {reservation.fechaExpiracion
              ? formatDateTime(reservation.fechaExpiracion)
              : copy.noExpiry}
          </Item>
        </dl>
      </section>

      <section
        aria-labelledby="sec-obs"
        className="bg-surface-container-lowest border-outline-variant/30 rounded-2xl border p-4"
      >
        <h2 id="sec-obs" className="font-headline-sm mb-3 text-lg font-bold">
          {copy.sections.notes}
        </h2>
        {/* React escapa el texto: las observaciones nunca se interpretan como HTML. */}
        <NotesForm
          action={saveNotesAction.bind(null, reservation.codigo)}
          initial={reservation.observaciones ?? ''}
        />
      </section>

      <section
        aria-labelledby="sec-acciones"
        className="bg-surface-container-lowest border-outline-variant/30 flex flex-col gap-3 rounded-2xl border p-4"
      >
        <h2 id="sec-acciones" className="font-headline-sm text-lg font-bold">
          {copy.sections.actions}
        </h2>
        <ReservationActionsPanel
          canNegotiate={canNegotiate}
          canCancel={canCancel}
          startAction={startNegotiationAction.bind(null, reservation.codigo)}
          cancelAction={cancelReservationAction.bind(null, reservation.codigo)}
        />
      </section>
    </div>
  );
}
