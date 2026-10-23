'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  href: string;
  label: string;
}

function NavList({ items, pathname }: { items: NavItem[]; pathname: string | null }) {
  return (
    <ul className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:overflow-visible md:pb-0">
      {items.map((item) => {
        const current =
          item.href === '/admin'
            ? pathname === '/admin'
            : pathname === item.href || pathname?.startsWith(`${item.href}/`);
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
  );
}

function CurrentNav({ items }: { items: NavItem[] }) {
  return <NavList items={items} pathname={usePathname()} />;
}

/** Menú del panel: pestañas con scroll interno en móvil y lista lateral en escritorio. */
export function AdminNav({ items, label }: { items: NavItem[]; label: string }) {
  return (
    <nav aria-label={label}>
      {/* `usePathname` en rutas dinámicas exige Suspense; el respaldo muestra los mismos enlaces sin «actual». */}
      <Suspense fallback={<NavList items={items} pathname={null} />}>
        <CurrentNav items={items} />
      </Suspense>
    </nav>
  );
}
