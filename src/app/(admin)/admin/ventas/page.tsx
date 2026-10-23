import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { formatDateTime, formatExactCOP } from '@/lib/format';
import { siteContent } from '@/lib/site-content';
import { parseDayRange } from '@/server/admin/day-range';
import { listSales } from '@/server/admin/sales';
import { requireStaff } from '@/server/auth/staff';

const copy = siteContent.adminSales;

export const metadata: Metadata = { title: copy.title };

type Raw = Record<string, string | string[] | undefined>;

function one(raw: Raw, key: string): string | undefined {
  const value = raw[key];
  return Array.isArray(value) ? value[0] : value;
}

const fieldClass =
  'bg-surface-container-low text-on-surface focus-visible:ring-primary w-full rounded-lg border border-outline-variant/40 px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none';
const linkClass =
  'border-outline-variant/40 text-on-surface hover:bg-surface-container-low focus-visible:ring-primary rounded-lg border px-4 py-2 text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none';

export default async function AdminSalesPage({ searchParams }: { searchParams: Promise<Raw> }) {
  await requireStaff('/admin/ventas');
  const raw = await searchParams;
  const fromRaw = one(raw, 'desde')?.slice(0, 10);
  const toRaw = one(raw, 'hasta')?.slice(0, 10);
  const range = parseDayRange(fromRaw, toRaw);
  const pageParam = one(raw, 'pagina');
  const { items, total, totalAmount, page, pageCount } = await listSales({
    from: range.from,
    to: range.to,
    page: pageParam && /^[1-9]\d{0,5}$/.test(pageParam) ? Number(pageParam) : 1,
  });

  const pageHref = (target: number) => {
    const params = new URLSearchParams();
    if (range.valid && fromRaw) params.set('desde', fromRaw);
    if (range.valid && toRaw) params.set('hasta', toRaw);
    if (target > 1) params.set('pagina', String(target));
    const query = params.toString();
    return query ? `/admin/ventas?${query}` : '/admin/ventas';
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-headline-xl text-on-surface text-3xl font-extrabold tracking-tight">
        {copy.title}
      </h1>

      <form
        method="get"
        action="/admin/ventas"
        role="search"
        className="bg-surface-container-lowest border-outline-variant/30 flex flex-wrap items-end gap-3 rounded-2xl border p-4"
      >
        <div>
          <label htmlFor="v-desde" className="text-sm font-semibold">
            {copy.filters.from}
          </label>
          <input
            id="v-desde"
            name="desde"
            type="date"
            defaultValue={range.valid ? fromRaw : ''}
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="v-hasta" className="text-sm font-semibold">
            {copy.filters.to}
          </label>
          <input
            id="v-hasta"
            name="hasta"
            type="date"
            defaultValue={range.valid ? toRaw : ''}
            className={fieldClass}
          />
        </div>
        <button
          type="submit"
          className="bg-primary text-on-primary focus-visible:ring-primary rounded-lg px-4 py-2 text-sm font-semibold hover:bg-neutral-800 focus-visible:ring-2 focus-visible:outline-none"
        >
          {copy.filters.apply}
        </button>
        <Link href="/admin/ventas" className={linkClass}>
          {copy.filters.clear}
        </Link>
      </form>

      {!range.valid && (
        <p
          role="alert"
          className="bg-error-container text-on-error-container rounded-lg px-4 py-3 text-sm"
        >
          {copy.filters.invalidRange}
        </p>
      )}

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="bg-surface-container-lowest border-outline-variant/30 rounded-2xl border p-4">
          <dt className="text-on-surface-variant text-sm">{copy.count}</dt>
          <dd className="font-headline-md text-on-surface mt-1 text-2xl font-extrabold break-words tabular-nums">
            {total}
          </dd>
        </div>
        <div className="bg-surface-container-lowest border-outline-variant/30 rounded-2xl border p-4">
          <dt className="text-on-surface-variant text-sm">{copy.total}</dt>
          <dd
            data-testid="sales-total"
            className="font-headline-md text-on-surface mt-1 text-2xl font-extrabold break-words tabular-nums"
          >
            {formatExactCOP(totalAmount)}
          </dd>
        </div>
      </dl>

      {items.length === 0 ? (
        <p className="text-on-surface-variant text-sm">{copy.empty}</p>
      ) : (
        <div className="bg-surface-container-lowest border-outline-variant/30 relative overflow-x-auto rounded-2xl border">
          <table aria-label={copy.listLabel} className="w-full min-w-[56rem] text-left text-sm">
            <thead className="bg-surface-container-low text-on-surface-variant text-xs">
              <tr>
                <th scope="col" className="px-4 py-3">
                  {copy.columns.receipt}
                </th>
                <th scope="col" className="px-4 py-3">
                  {copy.columns.date}
                </th>
                <th scope="col" className="px-4 py-3">
                  {copy.columns.vehicle}
                </th>
                <th scope="col" className="px-4 py-3">
                  {copy.columns.buyer}
                </th>
                <th scope="col" className="px-4 py-3">
                  {copy.columns.seller}
                </th>
                <th scope="col" className="px-4 py-3">
                  {copy.columns.price}
                </th>
                <th scope="col" className="px-4 py-3">
                  {copy.columns.method}
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((sale) => (
                <tr key={sale.id} className="border-outline-variant/20 border-t">
                  <th
                    scope="row"
                    className="font-spec-numerical px-4 py-3 font-semibold whitespace-nowrap"
                  >
                    <Link
                      href={`/admin/ventas/${sale.recibo}`}
                      className="text-secondary hover:underline"
                    >
                      {sale.recibo}
                    </Link>
                  </th>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(sale.fecha)}</td>
                  <td className="px-4 py-3">{sale.vehiculo}</td>
                  <td className="px-4 py-3">{sale.comprador}</td>
                  <td className="px-4 py-3">{sale.vendedor ?? copy.sellerMissing}</td>
                  <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                    {formatExactCOP(sale.precio)}
                  </td>
                  <td className="px-4 py-3">{copy.methodLabels[sale.metodo]}</td>
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
