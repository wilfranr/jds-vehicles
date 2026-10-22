import React from 'react';
import { WhatsAppIcon } from '@/components/ui/BrandIcons';
import { buildWhatsAppUrl } from '@/lib/whatsapp';
import { siteContent } from '@/lib/site-content';
import { Disponibilidad } from '@prisma/client';

interface ReserveCtaProps {
  vehicleId: number;
  marca: string;
  modelo: string;
  anio: number;
  disponibilidad: Disponibilidad;
  whatsappNumber: string;
}

/**
 * Componente que aísla la decisión de llamada a la acción para la reserva:
 * - En Fase 1 (actual): los botones dirigen a WhatsApp con mensaje contextual prellenado.
 * - En Fase 3: el botón DISPONIBLE mutará a la creación formal de reserva con Auth.js (Fase 2).
 */
export function ReserveCta({
  vehicleId,
  marca,
  modelo,
  anio,
  disponibilidad,
  whatsappNumber,
}: ReserveCtaProps) {
  // Construir mensaje específico por vehículo para WhatsApp
  const vehicleLabel = `${marca} ${modelo} ${anio} (Ref: #${vehicleId})`;
  const generalWhatsAppUrl = buildWhatsAppUrl(whatsappNumber, siteContent.defaultWhatsAppMessage);

  if (disponibilidad === Disponibilidad.RESERVADO) {
    const message = `Hola JDS Vehículos, vi que el vehículo ${vehicleLabel} se encuentra reservado. ¿Tienen alguna alternativa similar disponible?`;
    const whatsappUrl = buildWhatsAppUrl(whatsappNumber, message);

    return (
      <div className="flex flex-col gap-2.5">
        <div className="bg-surface-container-low border-outline-variant/30 text-on-surface flex flex-col gap-3 rounded-xl border p-4">
          <div className="flex items-center gap-2">
            <span className="bg-status-reservado h-2.5 w-2.5 animate-pulse rounded-full"></span>
            <span className="font-label-lg text-on-surface text-sm font-bold">
              {siteContent.vehicleDetail.reservedTitle}
            </span>
          </div>
          <p className="font-body-sm text-on-surface-variant text-xs">
            {siteContent.vehicleDetail.reservedDescription}
          </p>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-label-lg flex w-full items-center justify-center gap-2 rounded-lg bg-[#0e7c42] px-4 py-3 text-sm text-white shadow-sm transition-all hover:bg-[#0b6a38] focus-visible:ring-2 focus-visible:ring-[#25D366] focus-visible:outline-none"
          >
            <WhatsAppIcon className="h-5 w-5 shrink-0 fill-white" />
            <span>{siteContent.vehicleDetail.reservedCta}</span>
          </a>
        </div>

        {/* Botón secundario siempre presente */}
        <a
          href={generalWhatsAppUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-label-md border-outline-variant/60 hover:bg-surface-container-low text-on-surface flex w-full items-center justify-center gap-2 rounded-xl border bg-transparent px-6 py-2.5 text-sm font-semibold shadow-sm transition-all focus-visible:ring-2 focus-visible:ring-[#25D366] focus-visible:outline-none"
        >
          <WhatsAppIcon className="h-4 w-4 shrink-0 fill-[#25D366]" />
          <span>{siteContent.vehicleDetail.writeWhatsAppCta}</span>
        </a>
      </div>
    );
  }

  if (disponibilidad === Disponibilidad.PROXIMAMENTE) {
    const message = `Hola JDS Vehículos, quisiera información sobre el vehículo en preventa ${vehicleLabel}. ¿Cuándo estará disponible?`;
    const whatsappUrl = buildWhatsAppUrl(whatsappNumber, message);

    return (
      <div className="flex flex-col gap-2.5">
        <div className="bg-surface-container-low border-outline-variant/30 text-on-surface flex flex-col gap-3 rounded-xl border p-4">
          <div className="flex items-center gap-2">
            <span className="bg-status-proximamente h-2.5 w-2.5 rounded-full"></span>
            <span className="font-label-lg text-on-surface text-sm font-bold">
              {siteContent.vehicleDetail.preorderTitle}
            </span>
          </div>
          <p className="font-body-sm text-on-surface-variant text-xs">
            {siteContent.vehicleDetail.preorderDescription}
          </p>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-label-lg flex w-full items-center justify-center gap-2 rounded-lg bg-[#0e7c42] px-4 py-3 text-sm text-white shadow-sm transition-all hover:bg-[#0b6a38] focus-visible:ring-2 focus-visible:ring-[#25D366] focus-visible:outline-none"
          >
            <WhatsAppIcon className="h-5 w-5 shrink-0 fill-white" />
            <span>{siteContent.vehicleDetail.preorderCta}</span>
          </a>
        </div>

        {/* Botón secundario siempre presente */}
        <a
          href={generalWhatsAppUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-label-md border-outline-variant/60 hover:bg-surface-container-low text-on-surface flex w-full items-center justify-center gap-2 rounded-xl border bg-transparent px-6 py-2.5 text-sm font-semibold shadow-sm transition-all focus-visible:ring-2 focus-visible:ring-[#25D366] focus-visible:outline-none"
        >
          <WhatsAppIcon className="h-4 w-4 shrink-0 fill-[#25D366]" />
          <span>{siteContent.vehicleDetail.writeWhatsAppCta}</span>
        </a>
      </div>
    );
  }

  // DISPONIBLE
  // TODO(F3): Cuando exista autenticación (Fase 2) y el flujo de reserva (Fase 3),
  // el botón principal llevará a `/login?next=/vehiculos/${vehicleId}` o a la Server Action de reserva.
  const consultMessage = `Hola JDS Vehículos, estoy interesado en reservar el vehículo ${vehicleLabel}. ¿Cómo podemos coordinar?`;
  const whatsappUrl = buildWhatsAppUrl(whatsappNumber, consultMessage);

  return (
    <div className="flex flex-col gap-2.5">
      {/* Botón principal de Reserva / Consulta */}
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="bg-secondary text-on-secondary font-label-lg hover:bg-on-secondary-fixed-variant focus-visible:ring-secondary flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-base font-bold shadow-md transition-all focus-visible:ring-2 focus-visible:outline-none active:scale-[0.99]"
      >
        <span>{siteContent.vehicleDetail.reserveAvailableCta}</span>
      </a>

      {/* Botón secundario directo de WhatsApp */}
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="font-label-md flex w-full items-center justify-center gap-2 rounded-xl bg-[#0e7c42] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#0b6a38] focus-visible:ring-2 focus-visible:ring-[#25D366] focus-visible:outline-none"
      >
        <WhatsAppIcon className="h-4 w-4 shrink-0 fill-white" />
        <span>{siteContent.vehicleDetail.writeWhatsAppCta}</span>
      </a>
    </div>
  );
}
