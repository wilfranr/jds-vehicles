import React from 'react';
import { redirect } from 'next/navigation';
import { parseCatalogFilters, type RawCatalogFiltersInput } from '@/server/catalog/filters';
import { listVehicles, getFilterOptions } from '@/server/catalog/queries';
import { VehicleCard } from '@/components/catalog/VehicleCard';
import { CatalogFilters } from '@/components/catalog/CatalogFilters';
import { Pagination } from '@/components/catalog/Pagination';
import { EmptyState } from '@/components/catalog/EmptyState';

export const metadata = {
  title: 'Catálogo de Vehículos | JDS Vehículos',
  description:
    'Explora nuestro inventario de vehículos certificados nuevos y seminuevos con garantía y peritaje verificado.',
};

interface CatalogoPageProps {
  searchParams: Promise<RawCatalogFiltersInput>;
}

export default async function CatalogoPage({ searchParams }: CatalogoPageProps) {
  const rawParams = await searchParams;
  const filters = parseCatalogFilters(rawParams);

  const [filterOptions, catalogResult] = await Promise.all([
    getFilterOptions(),
    listVehicles(filters),
  ]);

  // Si la página solicitada excede la cantidad total de páginas existentes, redirigir a la última válida
  if (catalogResult.pageCount > 0 && filters.pagina > catalogResult.pageCount) {
    const params = new URLSearchParams();
    if (filters.q) params.set('q', filters.q);
    if (filters.condicion) params.set('condicion', filters.condicion);
    if (filters.marca) params.set('marca', String(filters.marca));
    if (filters.modelo) params.set('modelo', String(filters.modelo));
    if (filters.precioMin) params.set('precioMin', String(filters.precioMin));
    if (filters.precioMax) params.set('precioMax', String(filters.precioMax));
    if (filters.anioMin) params.set('anioMin', String(filters.anioMin));
    if (filters.anioMax) params.set('anioMax', String(filters.anioMax));
    if (filters.color) params.set('color', filters.color);
    if (filters.transmision) params.set('transmision', filters.transmision);
    if (filters.combustible) params.set('combustible', filters.combustible);
    if (filters.orden && filters.orden !== 'recientes') params.set('orden', filters.orden);
    params.set('pagina', String(catalogResult.pageCount));

    redirect(`/catalogo?${params.toString()}`);
  }

  return (
    <div className="px-gutter py-space-xl mx-auto w-full max-w-7xl">
      {/* Encabezado del catálogo */}
      <div className="mb-8">
        <h1 className="font-headline-xl text-on-surface text-3xl font-bold tracking-tight md:text-4xl">
          Catálogo / Inventario
        </h1>
        <p className="font-body-lg text-on-surface-variant mt-1 text-base">
          Vehículos inspeccionados y certificados listos para entrega.
        </p>
      </div>

      <div className="gap-space-lg flex flex-col items-start lg:flex-row">
        {/* Filtros laterales */}
        <CatalogFilters options={filterOptions} currentFilters={filters} />

        {/* Zona de contenido principal */}
        <div className="w-full min-w-0 flex-1">
          {catalogResult.items.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              {/* Rejilla responsive: 1 col móvil, 2 cols tablet, 3 cols escritorio */}
              <div className="gap-space-lg grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                {catalogResult.items.map((vehicle) => (
                  <VehicleCard key={vehicle.id} vehicle={vehicle} />
                ))}
              </div>

              {/* Paginación */}
              <Pagination
                currentPage={catalogResult.page}
                pageCount={catalogResult.pageCount}
                totalItems={catalogResult.total}
                pageSize={catalogResult.pageSize}
                filters={filters}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
