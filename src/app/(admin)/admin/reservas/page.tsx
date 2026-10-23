import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ReservationStatusChip } from '@/components/account/ReservationStatusChip';
import { formatDateTime } from '@/lib/format';
import { siteContent } from '@/lib/site-content';
import { listAdminReservations, type AdminReservationFilters } from '@/server/admin/reservations';
import { requireStaff } from '@/server/auth/staff';

const copy = siteContent.adminReservations;

export const metadata: Metadata = { title: copy.title };

type Raw = Record<string, string | string[] | undefined>;
const STATES = [
  'PENDIENTE_CONTACTO',
  'EN_NEGOCIACION',
  'COMPLETADA',
  'CANCELADA',
  'EXPIRADA',
] as const;

function one(raw: Raw, key: string): string | undefined {
  const value = raw[key];
  return Array.isArray(value) ? value[0] : value;
}

function parseFilters(raw: Raw): AdminReservationFilters {
  const estado = one(raw, 'estado');
  const page = one(raw, 'pagina');
  return {
    q: one(raw, 'q')?.slice(0, 150),
    estado: STATES.find((s) => s === estado),
    page: page && /^[1-9]\d{0,5}$/.test(page) ? Number(page) : 1,
  };
}

const fieldClass =
  'bg-surface-container-low text-on-surface focus-visible:ring-primary w-full rounded-lg border border-outline-variant/40 px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none';
const linkClass =
  'border-outline-variant/40 text-on-surface hover:bg-surface-container-low focus-visible:ring-primary rounded-lg border px-4 py-2 text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none';

export default async function AdminReservationsPage({
  searchParams,
}: {
  searchParams: Promise<Raw>;
}) {
  await requireStaff('/admin/reservas');
  const filters = parseFilters(await searchParams);
  const { items, page, pageCount } = await listAdminReservations(filters);

  const pageHref = (target: number) => {
    const params = new URLSearchParams();
    if (filters.q) params.set('q', filters.q);
    if (filters.estado) params.set('estado', filters.estado);
    if (target > 1) params.set('pagina', String(target));
    const query = params.toString();
    return query ? `/admin/reservas?${query}` : '/admin/reservas';
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-headline-xl text-on-surface text-3xl font-extrabold tracking-tight">
        {copy.title}
      </h1>

      <form
        method="get"
        action="/admin/reservas"
        role="search"
        className="bg-surface-container-lowest border-outline-variant/30 grid grid-cols-1 gap-3 rounded-2xl border p-4 sm:grid-cols-3"
      >
        <div className="sm:col-span-1">
          <label htmlFor="r-q" className="text-sm font-semibold">
            {copy.filters.search}
          </label>
          <input
            id="r-q"
            name="q"
            defaultValue={filters.q}
            placeholder={copy.filters.searchPlaceholder}
            maxLength={150}
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="r-estado" className="text-sm font-semibold">
            {copy.filters.status}
          </label>
          <select
            id="r-estado"
            name="estado"
            defaultValue={filters.estado ?? ''}
            className={fieldClass}
          >
            <option value="">{copy.filters.active}</option>
            {STATES.map((s) => (
              <option key={s} value={s}>
                {siteContent.cuenta.reservations.statusLabels[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="bg-primary text-on-primary focus-visible:ring-primary rounded-lg px-4 py-2 text-sm font-semibold hover:bg-neutral-800 focus-visible:ring-2 focus-visible:outline-none"
          >
            {copy.filters.apply}
          </button>
          <Link href="/admin/reservas" className={linkClass}>
            {copy.filters.clear}
          </Link>
        </div>
      </form>

      {items.length === 0 ? (
        <p className="text-on-surface-variant text-sm">{copy.empty}</p>
      ) : (
        <div className="bg-surface-container-lowest border-outline-variant/30 overflow-x-auto rounded-2xl border">
          <table aria-label={copy.listLabel} className="w-full min-w-[46rem] text-left text-sm">
            <thead className="bg-surface-container-low text-on-surface-variant text-xs">
              <tr>
                <th scope="col" className="px-4 py-3">
                  {copy.columns.code}
                </th>
                <th scope="col" className="px-4 py-3">
                  {copy.columns.client}
                </th>
                <th scope="col" className="px-4 py-3">
                  {copy.columns.vehicle}
                </th>
                <th scope="col" className="px-4 py-3">
                  {copy.columns.status}
                </th>
                <th scope="col" className="px-4 py-3">
                  {copy.columns.date}
                </th>
                <th scope="col" className="px-4 py-3">
                  {copy.columns.expires}
                </th>
                <th scope="col" className="px-4 py-3">
                  {copy.columns.actions}
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} className="border-outline-variant/20 border-t">
                  <th
                    scope="row"
                    className="font-spec-numerical px-4 py-3 font-semibold whitespace-nowrap"
                  >
                    {r.codigo}
                  </th>
                  <td className="px-4 py-3">{r.cliente}</td>
                  <td className="px-4 py-3">{r.vehiculo}</td>
                  <td className="px-4 py-3">
                    <ReservationStatusChip estado={r.estado} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(r.fechaReserva)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {r.fechaExpiracion ? formatDateTime(r.fechaExpiracion) : copy.noExpiry}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/reservas/${r.codigo}`}
                      aria-label={`${copy.view}: ${r.codigo}`}
                      className="text-secondary font-semibold hover:underline focus-visible:ring-2 focus-visible:outline-none"
                    >
                      {copy.view}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pageCount > 1 && (
        <nav aria-label={copy.listLabel} className="flex items-center justify-between gap-3">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className={linkClass}>
              {copy.previousPage}
            </Link>
          ) : (
            <span />
          )}
          <span className="text-on-surface-variant text-sm">
            {copy.pageOf.replace('{page}', String(page)).replace('{total}', String(pageCount))}
          </span>
          {page < pageCount ? (
            <Link href={pageHref(page + 1)} className={linkClass}>
              {copy.nextPage}
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
