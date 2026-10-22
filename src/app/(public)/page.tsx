import React from 'react';
import Link from 'next/link';
import { Search, ArrowRight, ShieldCheck, Clock, Award } from 'lucide-react';
import { siteContent, trustMetrics } from '@/lib/site-content';
import { listVehicles } from '@/server/catalog/queries';
import { parseCatalogFilters } from '@/server/catalog/filters';
import { VehicleCard } from '@/components/catalog/VehicleCard';
import { Disponibilidad } from '@prisma/client';

export const metadata = {
  title: 'JDS Vehículos | Autos Nuevos y Seminuevos Certificados',
  description:
    'Encuentra tu próximo auto nuevo o seminuevo certificado en JDS Vehículos. Inspección pericial de 120 puntos y entrega garantizada.',
};

export default async function HomePage() {
  // Obtener hasta 6 vehículos disponibles destacados (los más recientes)
  const featured = await listVehicles(
    parseCatalogFilters({
      orden: 'recientes',
      disponibilidad: Disponibilidad.DISPONIBLE,
    })
  );

  const featuredVehicles = featured.items.slice(0, 6);

  return (
    <div className="flex w-full flex-col">
      {/* Top Ambient Banner / Hero Section */}
      <section className="bg-surface-container-low py-space-xl border-outline-variant/20 relative w-full overflow-hidden border-b">
        <div className="bg-primary-fixed/30 pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full blur-3xl"></div>
        <div className="bg-secondary-container/10 pointer-events-none absolute -bottom-20 left-1/3 h-80 w-80 rounded-full blur-2xl"></div>

        <div className="px-gutter gap-space-lg relative z-10 mx-auto flex max-w-7xl flex-col">
          <div className="gap-space-md flex flex-col justify-between lg:flex-row lg:items-end">
            <div className="gap-space-xs flex max-w-2xl flex-col">
              <div className="gap-space-xs flex items-center">
                <span className="bg-secondary-container inline-flex h-2 w-2 animate-pulse items-center justify-center rounded-full"></span>
                <span className="font-label-sm text-label-sm text-on-surface-variant tracking-wider uppercase">
                  {siteContent.heroTag}
                </span>
              </div>
              <h1 className="font-headline-xl text-on-surface text-3xl leading-tight font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
                {siteContent.heroTitle}
              </h1>
              <p className="font-body-lg text-on-surface-variant mt-1 text-base sm:text-lg">
                {siteContent.heroSubtitle}
              </p>
            </div>

            {/* Métricas editoriales (trustMetrics centralizadas) */}
            <div className="gap-space-md sm:gap-space-lg bg-surface-container-lowest px-space-md sm:px-space-lg py-space-md border-outline-variant/30 flex shrink-0 items-center rounded-xl border shadow-sm">
              {trustMetrics.map((metric, idx) => (
                <React.Fragment key={metric.label}>
                  {idx > 0 && <div className="bg-surface-container-high h-8 w-px"></div>}
                  <div className="flex flex-col">
                    <span className="font-headline-md text-on-surface text-xl font-bold sm:text-2xl">
                      {metric.value}
                    </span>
                    <span className="font-label-sm text-on-surface-variant text-xs">
                      {metric.label}
                    </span>
                  </div>
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Barra de Búsqueda Rápida (Formulario GET) */}
          <form
            action="/catalogo"
            method="GET"
            role="search"
            className="bg-surface-container-lowest p-space-sm border-outline-variant/30 gap-space-sm mt-2 flex flex-col items-center rounded-xl border shadow-md md:flex-row"
          >
            <div className="px-space-md py-space-xs gap-space-sm bg-surface-container-low focus-within:border-outline focus-within:ring-primary flex w-full flex-1 items-center rounded-lg border border-transparent focus-within:ring-1">
              <Search className="text-on-surface-variant h-5 w-5 shrink-0" />
              <label htmlFor="quick-hero-search" className="sr-only">
                Buscar por marca, modelo o edición
              </label>
              <input
                id="quick-hero-search"
                type="text"
                name="q"
                placeholder="Buscar por marca, modelo o edición (ej. BMW Serie 3, Mazda CX-30)..."
                className="font-body-md text-on-surface placeholder:text-outline w-full border-0 bg-transparent text-sm outline-none"
              />
            </div>
            <button
              type="submit"
              className="gap-space-xs px-space-lg bg-primary text-on-primary font-label-lg text-label-lg focus-visible:ring-primary flex w-full shrink-0 items-center justify-center rounded-lg py-2.5 shadow-sm transition-all hover:bg-neutral-800 focus-visible:ring-2 focus-visible:outline-none md:w-auto"
            >
              <span>Explorar Inventario</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </div>
      </section>

      {/* Sección de Vehículos Destacados */}
      <section className="px-gutter py-space-xl mx-auto w-full max-w-7xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="font-headline-xl text-on-surface text-2xl font-bold tracking-tight sm:text-3xl">
              Vehículos Disponibles Recientes
            </h2>
            <p className="font-body-md text-on-surface-variant mt-1 text-sm">
              Selección inmediata con peritaje e historial validado.
            </p>
          </div>
          <Link
            href="/catalogo"
            className="font-label-md text-secondary hidden items-center gap-1 text-sm hover:underline sm:flex"
          >
            <span>Ver todo el inventario</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {featuredVehicles.length === 0 ? (
          <div className="bg-surface-container-low rounded-xl p-8 text-center">
            <p className="text-on-surface-variant text-sm">
              No hay vehículos disponibles en este momento.
            </p>
          </div>
        ) : (
          <div className="gap-space-lg grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {featuredVehicles.map((vehicle) => (
              <VehicleCard key={vehicle.id} vehicle={vehicle} />
            ))}
          </div>
        )}

        <div className="mt-8 text-center sm:hidden">
          <Link
            href="/catalogo"
            className="bg-surface-container text-on-surface font-label-md hover:bg-surface-container-high inline-flex w-full items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm transition-colors"
          >
            <span>Ver todo el inventario</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Propuesta de Valor / Garantías */}
      <section className="bg-surface-container-low py-space-xl border-outline-variant/20 border-t">
        <div className="px-gutter gap-space-lg mx-auto grid max-w-7xl grid-cols-1 md:grid-cols-3">
          <div className="bg-surface-container-lowest border-outline-variant/20 flex items-start gap-3 rounded-xl border p-4 shadow-sm">
            <ShieldCheck className="text-secondary mt-0.5 h-8 w-8 shrink-0" />
            <div>
              <h3 className="font-label-lg text-on-surface text-base font-bold">
                Peritaje Certificado
              </h3>
              <p className="font-body-sm text-on-surface-variant mt-1 text-xs">
                Inspección mecánica y estructural para garantizar transparencia total.
              </p>
            </div>
          </div>
          <div className="bg-surface-container-lowest border-outline-variant/20 flex items-start gap-3 rounded-xl border p-4 shadow-sm">
            <Clock className="text-secondary mt-0.5 h-8 w-8 shrink-0" />
            <div>
              <h3 className="font-label-lg text-on-surface text-base font-bold">
                Entrega Inmediata
              </h3>
              <p className="font-body-sm text-on-surface-variant mt-1 text-xs">
                Trámites ágiles y disponibilidad en stock para entrega en tiempo récord.
              </p>
            </div>
          </div>
          <div className="bg-surface-container-lowest border-outline-variant/20 flex items-start gap-3 rounded-xl border p-4 shadow-sm">
            <Award className="text-secondary mt-0.5 h-8 w-8 shrink-0" />
            <div>
              <h3 className="font-label-lg text-on-surface text-base font-bold">Respaldo JDS</h3>
              <p className="font-body-sm text-on-surface-variant mt-1 text-xs">
                Acompañamiento personalizado en cada paso del proceso de compra.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
