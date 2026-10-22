'use client';

import React, { useEffect } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

export default function CatalogError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Error al cargar catálogo:', error);
  }, [error]);

  return (
    <div className="px-gutter py-space-xl mx-auto flex min-h-[50vh] max-w-7xl flex-col items-center justify-center text-center">
      <div className="bg-error-container text-on-error-container mb-4 flex h-16 w-16 items-center justify-center rounded-full">
        <AlertCircle className="h-8 w-8" />
      </div>
      <h2 className="font-headline-sm text-on-surface mb-2 text-2xl font-bold">
        Hubo un problema al cargar el catálogo
      </h2>
      <p className="font-body-md text-on-surface-variant mb-6 max-w-md text-sm">
        No se pudieron obtener los datos actualizados del inventario. Por favor intenta recargar la
        página.
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="bg-primary text-on-primary font-label-md focus-visible:ring-primary flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm shadow-sm transition-colors hover:bg-neutral-800 focus-visible:ring-2 focus-visible:outline-none"
      >
        <RotateCcw className="h-4 w-4" />
        <span>Reintentar</span>
      </button>
    </div>
  );
}
