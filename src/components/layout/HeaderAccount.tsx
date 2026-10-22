import React, { Suspense } from 'react';
import Link from 'next/link';
import { siteContent } from '@/lib/site-content';
import { getCurrentUser } from '@/server/auth';
import { AccountControls } from './AccountControls';
import { MobileAccount } from './MobileAccount';

const copy = siteContent.account;

async function DesktopAccount() {
  return <AccountControls user={await getCurrentUser()} />;
}

async function MobileAccountSection() {
  return <MobileAccount user={await getCurrentUser()} />;
}

/**
 * La sesión se lee solo aquí, dentro de un `<Suspense>`: el resto del header y de las páginas públicas
 * sigue siendo parte de la carcasa estática. El fallback reserva el espacio (sin saltos de diseño) y
 * ofrece un enlace con `<noscript>` porque sin JavaScript el contenido en streaming no se muestra.
 */
export function HeaderAccount() {
  return (
    <Suspense
      fallback={
        <div className="hidden md:block" role="status" aria-label={copy.loading}>
          <div className="bg-surface-container-low h-9 w-40 animate-pulse rounded-full" />
          <noscript>
            <Link href="/login" className="text-sm font-semibold">
              {copy.login}
            </Link>
          </noscript>
        </div>
      }
    >
      <DesktopAccount />
    </Suspense>
  );
}

export function MobileHeaderAccount() {
  return (
    <Suspense
      fallback={
        <div className="mt-4" role="status" aria-label={copy.loading}>
          <div className="bg-surface-container-low h-12 w-full animate-pulse rounded-lg" />
        </div>
      }
    >
      <MobileAccountSection />
    </Suspense>
  );
}
