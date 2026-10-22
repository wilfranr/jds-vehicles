import React from 'react';
import { siteContent } from '@/lib/site-content';
import { WhatsAppIcon } from '@/components/ui/BrandIcons';
import { buildWhatsAppUrl } from '@/lib/whatsapp';

interface WhatsAppFabProps {
  whatsappNumber: string;
}

export function WhatsAppFab({ whatsappNumber }: WhatsAppFabProps) {
  const whatsappUrl = buildWhatsAppUrl(whatsappNumber, siteContent.defaultWhatsAppMessage);

  return (
    <aside aria-label="Canales directos de atención">
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Contactar a JDS Vehículos por WhatsApp"
        className="gap-space-xs fixed right-6 bottom-6 z-40 flex items-center rounded-full bg-[#25D366] px-4 py-3 text-white shadow-[0_12px_32px_-4px_rgba(15,23,42,0.18)] transition-all hover:scale-105 hover:bg-[#20bd5a] hover:shadow-[0_20px_40px_-4px_rgba(15,23,42,0.25)] focus-visible:ring-4 focus-visible:ring-[#25D366]/40 focus-visible:outline-none active:scale-95"
      >
        <WhatsAppIcon className="h-6 w-6 shrink-0 fill-white" />
        <span className="font-label-lg text-label-lg hidden tracking-wide sm:inline">WhatsApp</span>
      </a>
    </aside>
  );
}
