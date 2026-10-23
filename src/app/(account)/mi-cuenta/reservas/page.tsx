import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ClipboardList } from 'lucide-react';
import { siteContent } from '@/lib/site-content';
import { requireUser } from '@/server/auth';

const copy = siteContent.cuenta.reservations;

export const metadata: Metadata = { title: copy.title };

// Las reservas reales llegan en la Fase 3: por ahora solo el estado vacío, sin datos inventados.
export default async function ReservationsPage() {
  await requireUser('/mi-cuenta/reservas');

  return (
    <section className="bg-surface-container-lowest border-outline-variant/30 p-space-lg flex flex-col items-center rounded-2xl border text-center shadow-sm">
      <div className="bg-surface-container mb-4 flex h-16 w-16 items-center justify-center rounded-full">
        <ClipboardList className="text-on-surface-variant h-8 w-8" aria-hidden="true" />
      </div>
      <h2 className="font-headline-sm text-on-surface mb-2 text-xl font-bold">{copy.emptyTitle}</h2>
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
