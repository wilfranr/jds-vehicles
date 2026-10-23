import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { formatCOP } from '@/lib/format';
import { siteContent } from '@/lib/site-content';
import { listAdminVehicles, type AdminVehicleFilters } from '@/server/admin/vehicles';
import { requireStaff } from '@/server/auth/staff';
import { setVisibilityAction } from './actions';

const copy = siteContent.adminVehicles;

export const metadata: Metadata = { title: copy.title };

type Raw = Record<string, string | string[] | undefined>;

function one(raw: Raw, key: string): string | undefined {
  const value = raw[key];
  return Array.isArray(value) ? value[0] : value;
}

/** Filtros desde la URL: solo valores conocidos; cualquier otra cosa se ignora. */
function parseFilters(raw: Raw): AdminVehicleFilters {
  const condicion = one(raw, 'condicion');
  const disponibilidad = one(raw, 'disponibilidad');
  const visible = one(raw, 'visible');
  const page = one(raw, 'pagina');
  return {
    q: one(raw, 'q')?.slice(0, 100),
    condicion: condicion === 'NUEVO' || condicion === 'USADO' ? condicion : undefined,
    disponibilidad: (['DISPONIBLE', 'RESERVADO', 'PROXIMAMENTE', 'VENDIDO'] as const).find(
      (d) => d === disponibilidad
    ),
    visible: visible === '1' ? true : visible === '0' ? false : undefined,
    page: page && /^[1-9]\d{0,5}$/.test(page) ? Number(page) : 1,
  };
}

const selectClass =
  'bg-surface-container-low text-on-surface focus-visible:ring-primary w-full rounded-lg border border-outline-variant/40 px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none';

export default async function AdminVehiclesPage({ searchParams }: { searchParams: Promise<Raw> }) {
  await requireStaff('/admin/vehiculos');
  const filters = parseFilters(await searchParams);
  const { items, page, pageCount, total } = await listAdminVehicles(filters);

  const pageHref = (target: number) => {
    const params = new URLSearchParams();
    if (filters.q) params.set('q', filters.q);
    if (filters.condicion) params.set('condicion', filters.condicion);
    if (filters.disponibilidad) params.set('disponibilidad', filters.disponibilidad);
    if (filters.visible !== undefined) params.set('visible', filters.visible ? '1' : '0');
    if (target > 1) params.set('pagina', String(target));
    const query = params.toString();
    return query ? `/admin/vehiculos?${query}` : '/admin/vehiculos';
  };
  const linkClass =
    'border-outline-variant/40 text-on-surface hover:bg-surface-container-low focus-visible:ring-primary rounded-lg border px-4 py-2 text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-headline-xl text-on-surface text-3xl font-extrabold tracking-tight">
          {copy.title}
        </h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/vehiculos/marcas" className={linkClass}>
            {copy.brandsCta}
          </Link>
          <Link
            href="/admin/vehiculos/nuevo"
            className="bg-primary text-on-primary focus-visible:ring-primary rounded-lg px-4 py-2 text-sm font-semibold hover:bg-neutral-800 focus-visible:ring-2 focus-visible:outline-none"
          >
            {copy.newCta}
          </Link>
        </div>
      </div>

      <form
        method="get"
        action="/admin/vehiculos"
        role="search"
        className="bg-surface-container-lowest border-outline-variant/30 grid grid-cols-1 gap-3 rounded-2xl border p-4 sm:grid-cols-2 lg:grid-cols-5"
      >
        <div className="sm:col-span-2 lg:col-span-2">
          <label htmlFor="f-q" className="text-sm font-semibold">
            {copy.filters.search}
          </label>
          <input
            id="f-q"
            name="q"
            defaultValue={filters.q}
            placeholder={copy.filters.searchPlaceholder}
            maxLength={100}
            className={selectClass}
          />
        </div>
        <div>
          <label htmlFor="f-condicion" className="text-sm font-semibold">
            {copy.filters.condition}
          </label>
          <select
            id="f-condicion"
            name="condicion"
            defaultValue={filters.condicion ?? ''}
            className={selectClass}
          >
            <option value="">{copy.filters.allF}</option>
            <option value="NUEVO">{copy.conditionLabels.NUEVO}</option>
            <option value="USADO">{copy.conditionLabels.USADO}</option>
          </select>
        </div>
        <div>
          <label htmlFor="f-disp" className="text-sm font-semibold">
            {copy.filters.availability}
          </label>
          <select
            id="f-disp"
            name="disponibilidad"
            defaultValue={filters.disponibilidad ?? ''}
            className={selectClass}
          >
            <option value="">{copy.filters.all}</option>
            {Object.entries(copy.availabilityLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="f-visible" className="text-sm font-semibold">
            {copy.filters.visibility}
          </label>
          <select
            id="f-visible"
            name="visible"
            defaultValue={filters.visible === undefined ? '' : filters.visible ? '1' : '0'}
            className={selectClass}
          >
            <option value="">{copy.filters.all}</option>
            <option value="1">{copy.filters.visible}</option>
            <option value="0">{copy.filters.hidden}</option>
          </select>
        </div>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-5">
          <button
            type="submit"
            className="bg-primary text-on-primary rounded-lg px-4 py-2 text-sm font-semibold hover:bg-neutral-800 focus-visible:ring-2 focus-visible:outline-none"
          >
            {copy.filters.apply}
          </button>
          <Link href="/admin/vehiculos" className={linkClass}>
            {copy.filters.clear}
          </Link>
        </div>
      </form>

      {items.length === 0 ? (
        <p className="text-on-surface-variant text-sm">{copy.empty}</p>
      ) : (
        <div className="bg-surface-container-lowest border-outline-variant/30 overflow-x-auto rounded-2xl border">
          <table aria-label={copy.listLabel} className="w-full min-w-[40rem] text-left text-sm">
            <thead className="bg-surface-container-low text-on-surface-variant text-xs">
              <tr>
                <th scope="col" className="px-4 py-3">
                  {copy.columns.vehicle}
                </th>
                <th scope="col" className="px-4 py-3">
                  {copy.columns.year}
                </th>
                <th scope="col" className="px-4 py-3">
                  {copy.columns.condition}
                </th>
                <th scope="col" className="px-4 py-3">
                  {copy.columns.price}
                </th>
                <th scope="col" className="px-4 py-3">
                  {copy.columns.availability}
                </th>
                <th scope="col" className="px-4 py-3">
                  {copy.columns.visible}
                </th>
                <th scope="col" className="px-4 py-3">
                  {copy.columns.actions}
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((v) => {
                const canToggle =
                  v.disponibilidad !== 'VENDIDO' && !(v.visible && v.hasActiveReservation);
                return (
                  <tr key={v.id} className="border-outline-variant/20 border-t">
                    <th scope="row" className="px-4 py-3 font-semibold">
                      {v.marca} {v.modelo}
                    </th>
                    <td className="px-4 py-3">{v.anio}</td>
                    <td className="px-4 py-3">{copy.conditionLabels[v.condicion]}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatCOP(v.precio)}</td>
                    <td className="px-4 py-3">{copy.availabilityLabels[v.disponibilidad]}</td>
                    <td className="px-4 py-3">{v.visible ? copy.visibleYes : copy.visibleNo}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/admin/vehiculos/${v.id}`}
                          aria-label={`${copy.edit}: ${v.marca} ${v.modelo} ${v.anio}`}
                          className="text-secondary font-semibold hover:underline focus-visible:ring-2 focus-visible:outline-none"
                        >
                          {copy.edit}
                        </Link>
                        {canToggle && (
                          <form action={setVisibilityAction.bind(null, v.id, !v.visible)}>
                            <button
                              type="submit"
                              aria-label={`${v.visible ? copy.hide : copy.show}: ${v.marca} ${v.modelo} ${v.anio}`}
                              className="text-on-surface font-semibold hover:underline focus-visible:ring-2 focus-visible:outline-none"
                            >
                              {v.visible ? copy.hide : copy.show}
                            </button>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
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
            {copy.pageOf.replace('{page}', String(page)).replace('{total}', String(pageCount))} ·{' '}
            {total}
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
