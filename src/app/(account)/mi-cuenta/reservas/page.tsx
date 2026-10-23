import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ClipboardList } from 'lucide-react';
import { ReservationCard } from '@/components/account/ReservationCard';
import { siteContent } from '@/lib/site-content';
import { requireUser } from '@/server/auth';
import { listUserReservations } from '@/server/reservations/queries';

const copy = siteContent.cuenta.reservations;

export const metadata: Metadata = { title: copy.title };

/** `?pagina=` estricto: entero positivo; cualquier otra cosa equivale a la primera página. */
function parsePage(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value && /^[1-9]\d{0,5}$/.test(value) ? Number(value) : 1;
}

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string | string[] }>;
}) {
  const user = await requireUser('/mi-cuenta/reservas');
  const { pagina } = await searchParams;
  const { items, page, pageCount } = await listUserReservations(user.id, parsePage(pagina));

  if (items.length === 0) {
    return (
      <section className="bg-surface-container-lowest border-outline-variant/30 p-space-lg flex flex-col items-center rounded-2xl border text-center shadow-sm">
        <div className="bg-surface-container mb-4 flex h-16 w-16 items-center justify-center rounded-full">
          <ClipboardList className="text-on-surface-variant h-8 w-8" aria-hidden="true" />
        </div>
        <h2 className="font-headline-sm text-on-surface mb-2 text-xl font-bold">
          {copy.emptyTitle}
        </h2>
        <p className="font-body-md text-on-surface-variant mb-6 max-w-md text-sm">
          {copy.emptyDescription}
        </p>
        <Link
          href="/catalogo"
          className="bg-primary text-on-primary font-label-md focus-visible:ring-primary rounded-lg px-5 py-2.5 text-sm shadow-sm transition-colors hover:bg-neutral-800 focus-visible:ring-2 focus-visible:outline-none"
        >
          {copy.catalogCta}
        </Link>
      </section>
    );
  }

  const pageHref = (target: number) =>
    target === 1 ? '/mi-cuenta/reservas' : `/mi-cuenta/reservas?pagina=${target}`;
  const linkClass =
    'border-outline-variant/40 text-on-surface hover:bg-surface-container-low focus-visible:ring-primary rounded-lg border px-4 py-2 text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none';

  return (
    <section aria-labelledby="reservas-titulo" className="flex flex-col gap-4">
      <h2 id="reservas-titulo" className="font-headline-sm text-on-surface text-lg font-bold">
        {copy.heading}
      </h2>
      <ul aria-label={copy.listLabel} className="flex flex-col gap-4">
        {items.map((reservation) => (
          <li key={reservation.id}>
            <ReservationCard reservation={reservation} />
          </li>
        ))}
      </ul>
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
    </section>
  );
}
