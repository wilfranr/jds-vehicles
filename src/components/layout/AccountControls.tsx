import React from 'react';
import Link from 'next/link';
import { siteContent } from '@/lib/site-content';
import type { AuthUser } from '@/types/auth';
import { UserMenu } from './UserMenu';

const copy = siteContent.account;

/** Botones de acceso (sin sesión) o menú de usuario (con sesión). Escritorio. */
export function AccountControls({ user }: { user: AuthUser | null }) {
  if (user) return <UserMenu user={user} />;

  return (
    <div className="hidden items-center gap-2 md:flex">
      <Link
        href="/login"
        className="font-label-md text-on-surface hover:bg-surface-container-low focus-visible:ring-primary rounded-full px-3.5 py-1.5 text-sm font-semibold whitespace-nowrap focus-visible:ring-2 focus-visible:outline-none"
      >
        {copy.login}
      </Link>
      <Link
        href="/registro"
        className="bg-primary text-on-primary font-label-md focus-visible:ring-primary rounded-full px-3.5 py-1.5 text-sm font-semibold whitespace-nowrap hover:bg-neutral-800 focus-visible:ring-2 focus-visible:outline-none"
      >
        {copy.register}
      </Link>
    </div>
  );
}
