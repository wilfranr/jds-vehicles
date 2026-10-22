import React from 'react';

export default function CatalogLoading() {
  return (
    <div className="px-gutter py-space-xl mx-auto w-full max-w-7xl animate-pulse">
      <div className="bg-surface-container mb-8 h-10 w-64 rounded-lg"></div>
      <div className="gap-space-lg flex flex-col items-start lg:flex-row">
        {/* Esqueleto Sidebar */}
        <aside className="bg-surface-container-lowest p-space-md border-outline-variant/20 hidden w-72 shrink-0 flex-col gap-4 rounded-xl border lg:flex">
          <div className="bg-surface-container h-6 w-32 rounded"></div>
          <div className="bg-surface-container-low h-10 w-full rounded-lg"></div>
          <div className="bg-surface-container-low h-10 w-full rounded-lg"></div>
          <div className="bg-surface-container-low h-10 w-full rounded-lg"></div>
          <div className="bg-surface-container-low h-10 w-full rounded-lg"></div>
        </aside>

        {/* Esqueleto Rejilla de Vehículos */}
        <div className="gap-space-lg grid w-full flex-1 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="bg-surface-container-lowest border-outline-variant/30 flex flex-col overflow-hidden rounded-xl border"
            >
              <div className="bg-surface-container aspect-[16/10] w-full"></div>
              <div className="p-space-md flex flex-col gap-3">
                <div className="bg-surface-container h-4 w-20 rounded"></div>
                <div className="bg-surface-container h-6 w-48 rounded"></div>
                <div className="bg-surface-container-low h-12 w-full rounded-lg"></div>
                <div className="flex items-center justify-between pt-2">
                  <div className="bg-surface-container h-6 w-28 rounded"></div>
                  <div className="bg-surface-container h-9 w-24 rounded-lg"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
