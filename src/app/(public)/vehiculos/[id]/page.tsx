import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight, ArrowLeft } from 'lucide-react';
import { getVehicleById, getSimilarVehicles } from '@/server/catalog/queries';
import { getDealerConfig } from '@/server/config';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { VehicleCard } from '@/components/catalog/VehicleCard';
import { VehicleGallery } from '@/components/catalog/VehicleGallery';
import { ReserveCtaWithSession } from '@/components/catalog/ReserveCtaWithSession';
import { SpecBadge } from '@/components/catalog/SpecBadge';
import { formatCOP } from '@/lib/format';
import { siteContent } from '@/lib/site-content';
import { buildVehicleJsonLd, serializeJsonLd } from '@/lib/structured-data';
import { getSiteUrl } from '@/lib/site-url';
import { Condicion, Disponibilidad } from '@prisma/client';

interface VehicleDetailPageProps {
  params: Promise<{ id: string }>;
}

const MAX_UNSIGNED_INT = 4294967295;

/**
 * Valida de forma estricta que un string represente un identificador entero positivo
 * dentro del rango UNSIGNED INT de MySQL (1 .. 4294967295).
 * Descarta valores no numéricos, flotantes (ej. "1.5"), exponenciales (ej. "1e3"),
 * enteros negativos, cero y números fuera de rango.
 */
export function parseVehicleId(rawId: string): number | null {
  if (!/^[1-9]\d{0,9}$/.test(rawId)) {
    return null;
  }
  const parsed = Number(rawId);
  if (!Number.isSafeInteger(parsed) || parsed > MAX_UNSIGNED_INT) {
    return null;
  }
  return parsed;
}

export async function generateMetadata({ params }: VehicleDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const numId = parseVehicleId(id);

  if (!numId) {
    return { title: siteContent.seo.notFoundVehicleTitle };
  }

  const vehicle = await getVehicleById(numId);
  if (!vehicle) {
    return { title: siteContent.seo.notFoundVehicleTitle };
  }

  const title = `${vehicle.marcaNombre} ${vehicle.modeloNombre} ${vehicle.anio}`;
  const description = `${vehicle.marcaNombre} ${vehicle.modeloNombre} ${vehicle.anio} - ${vehicle.condicion === Condicion.NUEVO ? 'Nuevo' : 'Seminuevo'} en ${vehicle.color}. Precio: ${formatCOP(vehicle.precio)}.`;

  return {
    title,
    description,
    alternates: { canonical: `/vehiculos/${vehicle.id}` },
    twitter: { title, description },
    openGraph: {
      title,
      description,
      images: vehicle.fotoPrincipalUrl ? [{ url: vehicle.fotoPrincipalUrl }] : [],
    },
  };
}

export default async function VehicleDetailPage({ params }: VehicleDetailPageProps) {
  const { id } = await params;
  const numId = parseVehicleId(id);

  // ID no numérico, con decimales, fuera de rango o inválido produce 404
  if (!numId) {
    notFound();
  }

  const [vehicle, dealerConfig] = await Promise.all([getVehicleById(numId), getDealerConfig()]);

  // Si no existe, está vendido u oculto, produce 404
  if (!vehicle) {
    notFound();
  }

  const similarVehicles = await getSimilarVehicles({
    id: vehicle.id,
    marcaId: vehicle.marcaId,
    precio: vehicle.precio,
  });

  const formattedMileage =
    vehicle.condicion === Condicion.NUEVO
      ? '0 km (Nuevo)'
      : `${vehicle.kilometraje.toLocaleString('es-CO')} km`;

  return (
    <div className="px-gutter py-space-md sm:py-space-xl mx-auto w-full max-w-7xl">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(buildVehicleJsonLd(vehicle, getSiteUrl())),
        }}
      />
      {/* Migas de Pan (Breadcrumbs) y Volver */}
      <div className="border-outline-variant/20 mb-6 flex flex-col justify-between gap-3 border-b pb-4 text-sm sm:flex-row sm:items-center">
        <nav
          aria-label="Migas de pan"
          className="text-on-surface-variant flex flex-wrap items-center gap-1.5"
        >
          <Link href="/" className="hover:text-on-surface transition-colors">
            {siteContent.vehicleDetail.breadcrumbHome}
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link href="/catalogo" className="hover:text-on-surface transition-colors">
            {siteContent.vehicleDetail.breadcrumbCatalog}
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-on-surface max-w-[200px] truncate font-semibold sm:max-w-none">
            {vehicle.marcaNombre} {vehicle.modeloNombre}
          </span>
        </nav>

        <Link
          href="/catalogo"
          className="text-secondary font-label-md inline-flex shrink-0 items-center gap-1.5 text-sm hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{siteContent.vehicleDetail.backToCatalog}</span>
        </Link>
      </div>

      {/* Grid Principal de 2 Columnas (Galería + Detalles) */}
      <div className="gap-space-lg grid grid-cols-1 items-start lg:grid-cols-12">
        {/* Columna Izquierda: Galería y Descripción (7 cols) */}
        <div className="gap-space-lg flex flex-col lg:col-span-7">
          <VehicleGallery
            photos={vehicle.fotos}
            title={`${vehicle.marcaNombre} ${vehicle.modeloNombre} ${vehicle.anio}`}
          />

          {/* Descripción Técnica */}
          <section
            aria-labelledby="descripcion-heading"
            className="p-space-lg bg-surface-container-lowest border-outline-variant/30 rounded-2xl border shadow-sm"
          >
            <h2
              id="descripcion-heading"
              className="font-headline-sm text-on-surface mb-3 text-xl font-bold"
            >
              {siteContent.vehicleDetail.descriptionHeading}
            </h2>
            {vehicle.descripcion ? (
              <div className="font-body-md text-on-surface-variant text-base leading-relaxed whitespace-pre-line">
                {vehicle.descripcion}
              </div>
            ) : (
              <p className="font-body-md text-on-surface-variant text-sm italic">
                {siteContent.vehicleDetail.noDescription}
              </p>
            )}
          </section>
        </div>

        {/* Columna Derecha: Tarjeta de Compra, Ficha Técnica y CTA (5 cols) */}
        <div className="gap-space-md sticky top-24 flex flex-col lg:col-span-5">
          <div className="p-space-lg bg-surface-container-lowest border-outline-variant/30 gap-space-md flex flex-col rounded-2xl border shadow-sm">
            {/* Header del Vehículo */}
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <StatusBadge status={vehicle.condicion} />
                {vehicle.disponibilidad !== Disponibilidad.DISPONIBLE && (
                  <StatusBadge status={vehicle.disponibilidad} />
                )}
              </div>

              <h1 className="font-headline-xl text-on-surface text-2xl font-extrabold tracking-tight sm:text-3xl">
                {vehicle.marcaNombre} {vehicle.modeloNombre}
              </h1>
              <p className="font-body-md text-on-surface-variant mt-0.5 text-sm">
                Modelo {vehicle.anio} · {vehicle.color}
              </p>
            </div>

            {/* Precio */}
            <div className="border-outline-variant/20 flex flex-col border-y py-3">
              <span className="font-body-sm text-on-surface-variant text-xs">
                {siteContent.vehicleDetail.priceLabel}
              </span>
              <span className="font-headline-xl text-on-surface text-3xl font-extrabold tracking-tight tabular-nums sm:text-4xl">
                {formatCOP(vehicle.precio)}
              </span>
            </div>

            {/* Fichas Técnicas / SpecBadges */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <SpecBadge label="Año" value={vehicle.anio} />
              <SpecBadge label="Kilometraje" value={formattedMileage} />
              <SpecBadge label="Transmisión" value={vehicle.transmision} />
              <SpecBadge label="Combustible" value={vehicle.combustible} />
              <SpecBadge
                label="Cilindraje"
                value={vehicle.cilindraje ? `${vehicle.cilindraje} cc` : 'N/D'}
              />
              <SpecBadge label="Color" value={vehicle.color} />
              {/* Placa enmascarada solo para USADO (ver F1-02) */}
              {vehicle.condicion === Condicion.USADO && vehicle.placaEnmascarada && (
                <SpecBadge label="Placa (Termina)" value={vehicle.placaEnmascarada} highlight />
              )}
            </div>

            {/* Llamada a la Acción (ReserveCta) */}
            <div className="pt-2">
              <ReserveCtaWithSession
                vehicleId={vehicle.id}
                marca={vehicle.marcaNombre}
                modelo={vehicle.modeloNombre}
                anio={vehicle.anio}
                disponibilidad={vehicle.disponibilidad}
                whatsappNumber={dealerConfig.whatsappNumber}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Sección Vehículos Similares */}
      {similarVehicles.length > 0 && (
        <section
          aria-labelledby="similares-heading"
          className="border-outline-variant/20 mt-16 border-t pt-12"
        >
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h2
                id="similares-heading"
                className="font-headline-lg text-on-surface text-2xl font-bold"
              >
                {siteContent.vehicleDetail.similarHeading}
              </h2>
              <p className="font-body-sm text-on-surface-variant mt-1 text-sm">
                {siteContent.vehicleDetail.similarSubtitle}
              </p>
            </div>
            <Link
              href="/catalogo"
              className="font-label-md text-secondary hidden items-center gap-1 text-sm hover:underline sm:inline-flex"
            >
              <span>{siteContent.vehicleDetail.viewAllCatalog}</span>
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="gap-space-lg grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {similarVehicles.map((similar) => (
              <VehicleCard key={similar.id} vehicle={similar} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
