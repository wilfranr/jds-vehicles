import React from 'react';
import Link from 'next/link';
import { LogOut } from 'lucide-react';
import { siteContent } from '@/lib/site-content';
import { logoutAction } from '@/server/auth/logout-action';
import type { AuthUser } from '@/types/auth';
import { accountLinks } from './account-links';

const copy = siteContent.account;

const rowClass =
  'font-label-lg text-on-surface hover:bg-surface-container-low focus-visible:ring-primary flex items-center gap-2 rounded-lg px-4 py-3 text-left focus-visible:ring-2 focus-visible:outline-none';

/** Sección de cuenta dentro del menú móvil (los enlaces y el botón cierran el menú desde `MobileMenu`). */
export function MobileAccount({ user }: { user: AuthUser | null }) {
  if (!user) {
    return (
      <div className="mt-4 flex flex-col gap-2">
        <Link href="/login" className={rowClass}>
          {copy.login}
        </Link>
        <Link
          href="/registro"
          className="bg-primary text-on-primary font-label-lg focus-visible:ring-primary rounded-lg px-4 py-3 text-center hover:bg-neutral-800 focus-visible:ring-2 focus-visible:outline-none"
        >
          {copy.register}
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-col gap-1">
      <p className="text-on-surface-variant px-4 pb-1 text-sm">{user.name}</p>
      {accountLinks(user.rol).map((link) => (
        <Link key={link.href} href={link.href} className={rowClass}>
          {link.label}
        </Link>
      ))}
      <form action={logoutAction}>
        <button type="submit" className={`${rowClass} w-full`}>
          <LogOut className="h-4 w-4" aria-hidden="true" />
          <span>{copy.logout}</span>
        </button>
      </form>
    </div>
  );
}
