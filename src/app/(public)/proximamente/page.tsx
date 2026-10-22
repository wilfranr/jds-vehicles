import React from 'react';
import type { Metadata } from 'next';
import { MessageCircle, Clock } from 'lucide-react';
import { listVehicles } from '@/server/catalog/queries';
import { getDealerConfig } from '@/server/config';
import { VehicleCard } from '@/components/catalog/VehicleCard';
import { siteContent } from '@/lib/site-content';
import { Disponibilidad } from '@prisma/client';

export const metadata: Metadata = {
  title: siteContent.proximamente.title,
  description: siteContent.proximamente.subtitle,
};

export default async function ProximamentePage() {
  const [catalogResult, dealerConfig] = await Promise.all([
    listVehicles({
      pagina: 1,
      disponibilidad: Disponibilidad.PROXIMAMENTE,
      orden: 'recientes',
    }),
    getDealerConfig(),
  ]);

  const vehicles = catalogResult.items;
  const whatsappUrl = `https://wa.me/${dealerConfig.whatsappNumber}?text=${encodeURIComponent(
    siteContent.proximamente.emptyWhatsAppMessage
  )}`;

  return (
    <div className="px-gutter py-space-xl mx-auto w-full max-w-7xl">
      {/* Encabezado */}
      <div className="mb-8">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-[#7C3AED]/10 px-3 py-1 text-xs font-semibold text-[#7C3AED]">
          <Clock className="h-3.5 w-3.5" />
          <span>Próximas Entradas</span>
        </div>
        <h1 className="font-headline-xl text-on-surface text-3xl font-bold tracking-tight md:text-4xl">
          {siteContent.proximamente.heading}
        </h1>
        <p className="font-body-lg text-on-surface-variant mt-1 text-base">
          {siteContent.proximamente.subtitle}
        </p>
      </div>

      {/* Grid de vehículos o estado vacío amable */}
      {vehicles.length === 0 ? (
        <div className="bg-surface-container-lowest border-outline-variant/30 flex min-h-[340px] flex-col items-center justify-center rounded-2xl border p-8 text-center shadow-sm">
          <div className="bg-surface-container mb-4 flex h-16 w-16 items-center justify-center rounded-full text-[#7C3AED]">
            <Clock className="h-8 w-8 stroke-1" />
          </div>
          <h2 className="font-headline-sm text-on-surface text-xl font-bold">
            {siteContent.proximamente.emptyTitle}
          </h2>
          <p className="font-body-md text-on-surface-variant mt-2 max-w-md text-sm leading-relaxed">
            {siteContent.proximamente.emptyDescription}
          </p>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-label-lg mt-6 inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1EBE5D] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#25D366]"
          >
            <MessageCircle className="h-4 w-4" />
            <span>{siteContent.proximamente.emptyCtaText}</span>
          </a>
        </div>
      ) : (
        <div className="gap-space-lg grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          {vehicles.map((vehicle) => (
            <VehicleCard key={vehicle.id} vehicle={vehicle} />
          ))}
        </div>
      )}
    </div>
  );
}
