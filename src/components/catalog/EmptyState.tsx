import React from 'react';
import Link from 'next/link';
import { SearchX, RotateCcw } from 'lucide-react';

export function EmptyState() {
  return (
    <div className="bg-surface-container-lowest border-outline-variant/30 my-8 flex flex-col items-center justify-center rounded-xl border p-12 text-center">
      <div className="bg-surface-container mb-4 flex h-16 w-16 items-center justify-center rounded-full">
        <SearchX className="text-on-surface-variant h-8 w-8" />
      </div>
      <h3 className="font-headline-sm text-on-surface mb-2 text-xl font-bold">
        No se encontraron vehículos
      </h3>
      <p className="font-body-md text-on-surface-variant mb-6 max-w-md text-sm">
        No hay unidades que coincidan exactamente con los filtros seleccionados. Intenta ajustar los
        criterios de búsqueda o restablecer los filtros.
      </p>
      <Link
        href="/catalogo"
        className="bg-primary text-on-primary font-label-md focus-visible:ring-primary flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm shadow-sm transition-colors hover:bg-neutral-800 focus-visible:ring-2 focus-visible:outline-none"
      >
        <RotateCcw className="h-4 w-4" />
        <span>Restablecer filtros</span>
      </Link>
    </div>
  );
}
