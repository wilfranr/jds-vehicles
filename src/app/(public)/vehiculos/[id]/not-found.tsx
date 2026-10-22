import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Car } from 'lucide-react';

export default function VehicleNotFound() {
  return (
    <div className="px-gutter py-space-xl mx-auto flex min-h-[60vh] max-w-7xl flex-col items-center justify-center text-center">
      <div className="bg-surface-container mb-4 flex h-16 w-16 items-center justify-center rounded-full">
        <Car className="text-on-surface-variant h-8 w-8" />
      </div>
      <h1 className="font-headline-sm text-on-surface mb-2 text-2xl font-bold sm:text-3xl">
        Vehículo no encontrado
      </h1>
      <p className="font-body-md text-on-surface-variant mb-6 max-w-md text-sm">
        La unidad que buscas no está disponible en este momento, ha sido vendida o el enlace es
        incorrecto.
      </p>
      <Link
        href="/catalogo"
        className="bg-primary text-on-primary font-label-md focus-visible:ring-primary flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm shadow-sm transition-colors hover:bg-neutral-800 focus-visible:ring-2 focus-visible:outline-none"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Explorar otros vehículos en el catálogo</span>
      </Link>
    </div>
  );
}
