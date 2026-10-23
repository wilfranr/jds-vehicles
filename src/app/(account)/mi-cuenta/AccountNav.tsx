'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { siteContent } from '@/lib/site-content';

const copy = siteContent.cuenta;

/** Navegación de la cuenta: pestañas en móvil (scroll interno), lista lateral en escritorio. */
export function AccountNav() {
  return <AccountNavLinks pathname={usePathname()} />;
}

/** Los mismos enlaces sin página actual: es el respaldo mientras `usePathname` espera en rutas dinámicas. */
export function AccountNavFallback() {
  return <AccountNavLinks pathname={null} />;
}

function AccountNavLinks({ pathname }: { pathname: string | null }) {
  return (
    <nav aria-label={copy.navLabel} className="md:w-48 md:shrink-0">
      <ul className="border-outline-variant/30 flex gap-1 overflow-x-auto border-b md:flex-col md:overflow-visible md:border-b-0">
        {copy.nav.map((item) => {
          const current =
            pathname === item.href ||
            (item.href === '/mi-cuenta/reservas' && pathname?.startsWith('/mi-cuenta/reservas/'));
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={current ? 'page' : undefined}
                className={`font-label-md focus-visible:ring-primary block rounded-lg px-3 py-2 text-sm whitespace-nowrap focus-visible:ring-2 focus-visible:outline-none ${
                  current
                    ? 'bg-primary text-on-primary'
                    : 'text-on-surface-variant hover:bg-surface-container'
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
