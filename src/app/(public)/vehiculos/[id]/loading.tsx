import React from 'react';

export default function VehicleDetailLoading() {
  return (
    <div
      aria-label="Cargando detalle del vehículo"
      className="px-gutter py-space-md sm:py-space-xl mx-auto w-full max-w-7xl animate-pulse"
    >
      {/* Breadcrumb skeleton */}
      <div className="border-outline-variant/20 mb-6 flex h-8 items-center justify-between border-b pb-4">
        <div className="bg-surface-container-high h-4 w-48 rounded" />
        <div className="bg-surface-container-high h-4 w-28 rounded" />
      </div>

      {/* Grid 2 cols */}
      <div className="gap-space-lg grid grid-cols-1 items-start lg:grid-cols-12">
        {/* Left col */}
        <div className="gap-space-lg flex flex-col lg:col-span-7">
          <div className="bg-surface-container aspect-[16/10] w-full rounded-2xl" />
          <div className="bg-surface-container-lowest border-outline-variant/30 h-40 rounded-2xl border p-6" />
        </div>

        {/* Right col */}
        <div className="gap-space-md flex flex-col lg:col-span-5">
          <div className="bg-surface-container-lowest border-outline-variant/30 h-96 rounded-2xl border p-6" />
        </div>
      </div>
    </div>
  );
}
