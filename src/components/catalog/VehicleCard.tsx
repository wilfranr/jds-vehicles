import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Gauge, Fuel, Cog, Images } from 'lucide-react';
import { type VehicleCardData } from '@/types/catalog';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatCOP } from '@/lib/format';
import { Condicion, Disponibilidad } from '@prisma/client';
import { isLocalMedia, thumbOf } from '@/lib/media-url';

interface VehicleCardProps {
  vehicle: VehicleCardData;
  /** Marca la imagen como prioritaria (LCP) para la primera tarjeta visible de una página. */
  priority?: boolean;
}

export function VehicleCard({ vehicle, priority = false }: VehicleCardProps) {
  const isReservado = vehicle.disponibilidad === Disponibilidad.RESERVADO;
  const isProximamente = vehicle.disponibilidad === Disponibilidad.PROXIMAMENTE;

  // Determinar la etiqueta del badge:
  // Si está reservado o próximamente, mostrar ese estado prioritario;
  // de lo contrario, mostrar NUEVO o USADO.
  const badgeStatus: Condicion | Disponibilidad = isReservado
    ? Disponibilidad.RESERVADO
    : isProximamente
      ? Disponibilidad.PROXIMAMENTE
      : vehicle.condicion;

  const formattedMileage =
    vehicle.condicion === Condicion.NUEVO
      ? '0 km (Nuevo)'
      : `${vehicle.kilometraje.toLocaleString('es-CO')} km`;

  return (
    <article className="group bg-surface-container-lowest border-outline-variant/30 flex flex-col overflow-hidden rounded-xl border shadow-[0_1px_3px_rgba(15,23,42,0.04),0_6px_16px_rgba(15,23,42,0.03)] transition-all hover:shadow-[0_12px_32px_-4px_rgba(15,23,42,0.08),0_4px_12px_-2px_rgba(15,23,42,0.03)]">
      {/* Zona de Imagen (16:10 aspect ratio) */}
      <div className="bg-surface-container relative aspect-[16/10] w-full overflow-hidden">
        {vehicle.fotoPrincipalUrl ? (
          <Image
            src={thumbOf(vehicle.fotoPrincipalUrl)}
            unoptimized={isLocalMedia(vehicle.fotoPrincipalUrl)}
            alt={`${vehicle.marcaNombre} ${vehicle.modeloNombre} ${vehicle.anio}`}
            fill
            priority={priority}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="bg-surface-container text-on-surface-variant font-body-sm flex h-full w-full items-center justify-center">
            <span>Foto no disponible</span>
          </div>
        )}

        {/* Badge superior izquierdo */}
        <div className="absolute top-3 left-3 z-10">
          <StatusBadge status={badgeStatus} />
        </div>

        {/* Contador de fotos inferior izquierdo (con glassmorphism) */}
        {vehicle.totalFotos > 0 && (
          <div className="bg-surface-container-lowest/85 font-spec-numerical text-on-surface absolute bottom-3 left-3 z-10 flex items-center gap-1 rounded-full px-2.5 py-1 text-xs shadow-sm backdrop-blur-md">
            <Images className="text-on-surface-variant h-3.5 w-3.5 shrink-0" />
            <span>{vehicle.totalFotos}</span>
          </div>
        )}
      </div>

      {/* Contenido / Especificaciones */}
      <div className="p-space-md gap-space-sm flex flex-1 flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-2">
            <span className="font-spec-numerical text-on-surface-variant text-xs">
              {vehicle.anio}
            </span>
            <span className="font-body-sm text-on-surface-variant max-w-[120px] truncate text-xs">
              {vehicle.color}
            </span>
          </div>

          <h3 className="font-headline-sm text-headline-sm text-on-surface mt-0.5 line-clamp-1 tracking-tight">
            {vehicle.marcaNombre} {vehicle.modeloNombre}
          </h3>

          {/* Cinta de especificaciones clave */}
          <div className="border-outline-variant/20 text-on-surface-variant mt-3 grid grid-cols-3 gap-2 border-y py-3">
            {/* Kilometraje */}
            <div className="flex flex-col items-center text-center">
              <Gauge className="text-on-surface-variant mb-1 h-4 w-4 shrink-0" />
              <span className="font-body-sm line-clamp-1 text-[11px] leading-tight">
                {formattedMileage}
              </span>
            </div>

            {/* Transmisión */}
            <div className="flex flex-col items-center text-center">
              <Cog className="text-on-surface-variant mb-1 h-4 w-4 shrink-0" />
              <span className="font-body-sm line-clamp-1 text-[11px] leading-tight capitalize">
                {vehicle.transmision.toLowerCase()}
              </span>
            </div>

            {/* Combustible / Cilindraje */}
            <div className="flex flex-col items-center text-center">
              <Fuel className="text-on-surface-variant mb-1 h-4 w-4 shrink-0" />
              <span className="font-body-sm line-clamp-1 text-[11px] leading-tight capitalize">
                {vehicle.cilindraje
                  ? `${(vehicle.cilindraje / 1000).toFixed(1)}L`
                  : vehicle.combustible.toLowerCase()}
              </span>
            </div>
          </div>
        </div>

        {/* Zona inferior: Precio y Acción */}
        <div className="flex flex-wrap items-end justify-between gap-2 pt-1 sm:flex-nowrap">
          <div className="flex flex-col">
            <span className="font-body-sm text-on-surface-variant text-xs">Precio</span>
            <span className="font-headline-md text-on-surface text-lg font-bold tracking-tight whitespace-nowrap tabular-nums sm:text-xl lg:text-lg xl:text-xl">
              {formatCOP(vehicle.precio)}
            </span>
          </div>

          <Link
            href={`/vehiculos/${vehicle.id}`}
            className={`font-label-md text-label-md focus-visible:ring-primary flex shrink-0 items-center justify-center rounded-lg px-3.5 py-2 whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:outline-none ${
              isReservado
                ? 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                : 'bg-primary text-on-primary hover:bg-neutral-800'
            }`}
          >
            Ver detalles
          </Link>
        </div>
      </div>
    </article>
  );
}
