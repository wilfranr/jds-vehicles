import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { LogOut } from 'lucide-react';
import { siteContent } from '@/lib/site-content';
import { logoutAction } from '@/server/auth/logout-action';
import { requireStaff } from '@/server/auth/staff';
import { AdminNav } from './AdminNav';

const copy = siteContent.admin;

/** Barra superior, navegación lateral y contenido. Usuarios y Configuración solo se listan para `ADMIN`. */
export async function AdminFrame({ children }: { children: React.ReactNode }) {
  const user = await requireStaff('/admin');
  const items = copy.nav
    .filter((item) => !item.adminOnly || user.rol === 'ADMIN')
    .map(({ href, label }) => ({ href, label }));

  return (
    <div className="bg-background min-h-screen md:flex">
      <aside className="border-outline-variant/30 bg-surface-container-lowest border-b md:min-h-screen md:w-60 md:shrink-0 md:border-r md:border-b-0">
        <div className="flex items-center gap-2 px-4 py-3 md:py-5">
          <Image src="/logo.jpg" alt="" width={32} height={32} className="rounded-full" />
          <span className="font-headline-sm text-on-surface text-base font-bold">{copy.title}</span>
        </div>
        <AdminNav items={items} label={copy.navLabel} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-outline-variant/30 bg-surface-container-lowest flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 md:px-6">
          <Link
            href="/"
            className="text-secondary font-label-md focus-visible:ring-primary text-sm font-semibold hover:underline focus-visible:ring-2 focus-visible:outline-none"
          >
            {copy.viewSite}
          </Link>
          <div className="flex items-center gap-3">
            <p className="text-on-surface min-w-0 text-sm">
              <span className="block max-w-[11rem] truncate font-semibold sm:max-w-xs">
                {user.name}
              </span>
              <span className="text-on-surface-variant block text-xs">
                {copy.roleLabels[user.rol]}
              </span>
            </p>
            <form action={logoutAction}>
              <button
                type="submit"
                className="border-outline-variant/40 text-on-surface hover:bg-surface-container-low focus-visible:ring-primary flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                <span>{siteContent.account.logout}</span>
              </button>
            </form>
          </div>
        </header>
        <main className="px-4 py-6 md:px-6">{children}</main>
      </div>
    </div>
  );
}
