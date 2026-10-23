import React from 'react';
import { getDealerConfig } from '@/server/config';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { WhatsAppFab } from '@/components/layout/WhatsAppFab';

/** Marco común del sitio (cabecera, pie y botón de WhatsApp) para los grupos de rutas `(public)` y `(auth)`. */
export async function SiteShell({
  children,
  readSession = true,
}: {
  children: React.ReactNode;
  /**
   * Si es `false` el header no lee la sesión (siempre muestra los botones de acceso) y la carcasa queda
   * totalmente estática. Se usa en `(auth)`: un hueco dinámico en el layout hace que la respuesta de un
   * formulario enviado sin JavaScript llegue sin la página (solo el fragmento dinámico).
   */
  readSession?: boolean;
}) {
  const { whatsappNumber, instagramUrl } = await getDealerConfig();

  return (
    <div className="bg-background font-body-md text-on-surface flex min-h-screen flex-col antialiased">
      <SiteHeader
        whatsappNumber={whatsappNumber}
        instagramUrl={instagramUrl}
        readSession={readSession}
      />
      <main className="w-full flex-1 pt-20">{children}</main>
      <SiteFooter whatsappNumber={whatsappNumber} instagramUrl={instagramUrl} />
      <WhatsAppFab whatsappNumber={whatsappNumber} />
    </div>
  );
}
