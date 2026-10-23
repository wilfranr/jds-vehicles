import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { AdminFrame } from '@/components/admin/AdminFrame';
import { siteContent } from '@/lib/site-content';

// Todo el panel queda fuera de buscadores (y no está en el sitemap ni en robots como ruta pública).
export const metadata: Metadata = {
  title: { default: siteContent.admin.title, template: `%s | ${siteContent.admin.title}` },
  robots: { index: false, follow: false },
};

/**
 * Armazón propio del panel (no usa el header público). La comprobación de acceso va dentro de `AdminFrame`,
 * pero cada página y cada acción vuelve a llamar a `requireStaff()` / `requireAdmin()`: un layout no se
 * vuelve a ejecutar en cada navegación, así que no es una barrera suficiente.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div
          role="status"
          aria-label={siteContent.admin.skipLabel}
          className="bg-surface-container-low min-h-screen animate-pulse"
        />
      }
    >
      <AdminFrame>{children}</AdminFrame>
    </Suspense>
  );
}
