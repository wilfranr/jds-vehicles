import React from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { type NormalizedCatalogFilters } from '@/server/catalog/filters';

interface PaginationProps {
  currentPage: number;
  pageCount: number;
  totalItems: number;
  pageSize: number;
  filters: NormalizedCatalogFilters;
}

export function Pagination({
  currentPage,
  pageCount,
  totalItems,
  pageSize,
  filters,
}: PaginationProps) {
  if (totalItems === 0) return null;

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  // Construir URL preservando filtros para un número de página dado
  const getPageUrl = (page: number) => {
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

    if (page > 1) {
      params.set('pagina', String(page));
    }

    const qs = params.toString();
    return `/catalogo${qs ? `?${qs}` : ''}`;
  };

  // Generar páginas numeradas visibles
  const pages: number[] = [];
  const maxButtons = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
  const endPage = Math.min(pageCount, startPage + maxButtons - 1);

  if (endPage - startPage + 1 < maxButtons) {
    startPage = Math.max(1, endPage - maxButtons + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  return (
    <div className="border-outline-variant/30 text-on-surface flex flex-col items-center justify-between gap-4 border-t py-8 sm:flex-row">
      {/* Resumen numérico */}
      <p className="font-body-sm text-on-surface-variant text-sm">
        Mostrando <span className="text-on-surface font-semibold">{startItem}</span>–
        <span className="text-on-surface font-semibold">{endItem}</span> de{' '}
        <span className="text-on-surface font-semibold">{totalItems}</span> vehículos
      </p>

      {/* Controles de paginación */}
      {pageCount > 1 && (
        <nav aria-label="Paginación de resultados" className="flex items-center gap-1.5">
          {/* Botón Anterior */}
          {currentPage > 1 ? (
            <Link
              href={getPageUrl(currentPage - 1)}
              className="border-outline-variant/40 bg-surface-container-lowest text-on-surface hover:bg-surface-container font-label-md flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm transition-colors"
              aria-label="Ir a la página anterior"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Anterior</span>
            </Link>
          ) : (
            <span
              aria-disabled="true"
              className="border-outline-variant/20 bg-surface-container-low text-outline font-label-md flex cursor-not-allowed items-center gap-1 rounded-lg border px-3 py-1.5 text-sm opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Anterior</span>
            </span>
          )}

          {/* Números de página */}
          <div className="flex items-center gap-1">
            {pages.map((p) => {
              const isCurrent = p === currentPage;
              return isCurrent ? (
                <span
                  key={p}
                  aria-current="page"
                  className="bg-primary text-on-primary flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold shadow-sm"
                >
                  {p}
                </span>
              ) : (
                <Link
                  key={p}
                  href={getPageUrl(p)}
                  className="border-outline-variant/30 bg-surface-container-lowest text-on-surface hover:bg-surface-container flex h-9 w-9 items-center justify-center rounded-lg border text-sm font-medium transition-colors"
                  aria-label={`Ir a la página ${p}`}
                >
                  {p}
                </Link>
              );
            })}
          </div>

          {/* Botón Siguiente */}
          {currentPage < pageCount ? (
            <Link
              href={getPageUrl(currentPage + 1)}
              className="border-outline-variant/40 bg-surface-container-lowest text-on-surface hover:bg-surface-container font-label-md flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm transition-colors"
              aria-label="Ir a la página siguiente"
            >
              <span className="hidden sm:inline">Siguiente</span>
              <ChevronRight className="h-4 w-4" />
            </Link>
          ) : (
            <span
              aria-disabled="true"
              className="border-outline-variant/20 bg-surface-container-low text-outline font-label-md flex cursor-not-allowed items-center gap-1 rounded-lg border px-3 py-1.5 text-sm opacity-50"
            >
              <span className="hidden sm:inline">Siguiente</span>
              <ChevronRight className="h-4 w-4" />
            </span>
          )}
        </nav>
      )}
    </div>
  );
}
