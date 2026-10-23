import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { siteContent } from '@/lib/site-content';
import { AccountNav, AccountNavFallback } from './AccountNav';

// Todas las páginas de la cuenta quedan fuera de buscadores (y del sitemap, que no las lista).
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-gutter py-space-xl mx-auto w-full max-w-4xl">
      <h1 className="font-headline-xl text-on-surface mb-6 text-3xl font-extrabold tracking-tight">
        {siteContent.cuenta.heading}
      </h1>
      <div className="gap-space-lg flex flex-col md:flex-row md:items-start">
        {/* `usePathname` en una ruta dinámica ([codigo]) exige un límite de Suspense. */}
        <Suspense fallback={<AccountNavFallback />}>
          <AccountNav />
        </Suspense>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
