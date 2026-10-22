import React from 'react';

export default function ProximamenteLoading() {
  return (
    <div
      aria-label="Cargando vehículos próximamente disponibles"
      className="px-gutter py-space-xl mx-auto w-full max-w-7xl animate-pulse"
    >
      <div className="mb-8">
        <div className="bg-surface-container mb-2 h-6 w-36 rounded-full" />
        <div className="bg-surface-container h-9 w-72 rounded-lg" />
        <div className="bg-surface-container mt-2 h-5 w-96 rounded" />
      </div>

      <div className="gap-space-lg grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-surface-container-lowest border-outline-variant/30 h-80 rounded-2xl border p-4 shadow-sm"
          >
            <div className="bg-surface-container aspect-[16/10] w-full rounded-xl" />
            <div className="bg-surface-container mt-4 h-6 w-3/4 rounded" />
            <div className="bg-surface-container mt-2 h-4 w-1/2 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
