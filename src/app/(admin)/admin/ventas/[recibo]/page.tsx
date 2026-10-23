import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatDateTime, formatExactCOP } from '@/lib/format';
import { siteContent } from '@/lib/site-content';
import { parseReceipt } from '@/lib/validation/sale';
import { getSale } from '@/server/admin/sales';
import { requireStaff } from '@/server/auth/staff';

const copy = siteContent.adminSales;

export const metadata: Metadata = { title: copy.detailTitle };

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-on-surface-variant text-sm">{label}</dt>
      <dd className="text-on-surface font-semibold break-words">{children}</dd>
    </div>
  );
}

// Solo lectura: las ventas no se editan ni se eliminan desde el panel.
export default async function AdminSaleDetailPage({
  params,
}: {
  params: Promise<{ recibo: string }>;
}) {
  const receipt = parseReceipt((await params).recibo);
  if (!receipt) notFound();

  await requireStaff(`/admin/ventas/${receipt}`);
  const sale = await getSale(receipt);
  if (!sale) notFound();

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Link href="/admin/ventas" className="text-secondary text-sm font-semibold hover:underline">
        {copy.backToList}
      </Link>
      <h1 className="font-headline-xl text-on-surface text-3xl font-extrabold tracking-tight">
        <span className="font-spec-numerical">{sale.recibo}</span>
      </h1>

      <section
        aria-label={copy.detailTitle}
        className="bg-surface-container-lowest border-outline-variant/30 rounded-2xl border p-4"
      >
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Item label={copy.columns.date}>{formatDateTime(sale.fecha)}</Item>
          <Item label={copy.columns.price}>{formatExactCOP(sale.precio)}</Item>
          <Item label={copy.columns.method}>{copy.methodLabels[sale.metodo]}</Item>
          <Item label={copy.columns.vehicle}>
            <Link href={`/admin/vehiculos/${sale.vehiculoId}`} className="hover:underline">
              {sale.vehiculo}
            </Link>
          </Item>
          <Item label={copy.columns.buyer}>{sale.comprador}</Item>
          <Item label={copy.columns.seller}>{sale.vendedor ?? copy.sellerMissing}</Item>
          {sale.reservaCodigo && (
            <Item label={siteContent.adminReservations.fields.code}>
              <Link
                href={`/admin/reservas/${sale.reservaCodigo}`}
                className="font-spec-numerical hover:underline"
              >
                {sale.reservaCodigo}
              </Link>
            </Item>
          )}
          {sale.observaciones && (
            <div className="sm:col-span-2">
              <dt className="text-on-surface-variant text-sm">{copy.notes}</dt>
              {/* React escapa el texto: nunca se interpreta como HTML. */}
              <dd className="text-on-surface break-words whitespace-pre-wrap">
                {sale.observaciones}
              </dd>
            </div>
          )}
        </dl>
      </section>
      <p className="text-on-surface-variant text-sm">{copy.readOnly}</p>
    </div>
  );
}
