import React from 'react';
import { getDealerConfig } from '@/server/config';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { WhatsAppFab } from '@/components/layout/WhatsAppFab';

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const { whatsappNumber, instagramUrl } = await getDealerConfig();

  return (
    <div className="bg-background font-body-md text-on-surface flex min-h-screen flex-col antialiased">
      <SiteHeader whatsappNumber={whatsappNumber} instagramUrl={instagramUrl} />
      <main className="w-full flex-1 pt-20">{children}</main>
      <SiteFooter whatsappNumber={whatsappNumber} instagramUrl={instagramUrl} />
      <WhatsAppFab whatsappNumber={whatsappNumber} />
    </div>
  );
}
