'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, LogOut, User } from 'lucide-react';
import { siteContent } from '@/lib/site-content';
import { logoutAction } from '@/server/auth/logout-action';
import type { AuthUser } from '@/types/auth';

const copy = siteContent.account;
const MAX_NAME_LENGTH = 14;

/** Primer nombre truncado para el botón del menú. */
export function displayFirstName(fullName: string): string {
  const first = fullName.trim().split(/\s+/)[0] ?? '';
  if (!first) return copy.myAccount;
  return first.length > MAX_NAME_LENGTH ? `${first.slice(0, MAX_NAME_LENGTH - 1)}…` : first;
}

export function accountLinks(rol: AuthUser['rol']) {
  const links: { label: string; href: string }[] = [
    { label: copy.myAccount, href: '/mi-cuenta' },
    { label: copy.myReservations, href: '/mi-cuenta/reservas' },
  ];
  if (copy.showAdminPanelLink && (rol === 'ADMIN' || rol === 'ASESOR')) {
    links.push({ label: copy.adminPanel, href: '/admin' });
  }
  return links;
}

const itemClass =
  'text-on-surface hover:bg-surface-container-low focus-visible:bg-surface-container-low flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm focus-visible:outline-none';

export function UserMenu({ user }: { user: AuthUser }) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const items = () =>
      Array.from(containerRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    items()[0]?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const list = items();
        const index = list.indexOf(document.activeElement as HTMLElement);
        const step = event.key === 'ArrowDown' ? 1 : -1;
        list[(index + step + list.length) % list.length]?.focus();
      }
    }
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`${copy.menuLabel}: ${user.name}`}
        onClick={() => setOpen((value) => !value)}
        className="bg-surface-container-low text-on-surface hover:bg-surface-container focus-visible:ring-primary flex items-center gap-2 rounded-full py-1.5 pr-3 pl-2 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none"
      >
        <User className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="max-w-[9rem] truncate">{displayFirstName(user.name)}</span>
        <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={copy.menuLabel}
          className="bg-surface-container-lowest border-outline-variant/30 absolute right-0 z-50 mt-2 w-56 rounded-xl border p-1.5 shadow-lg"
        >
          {accountLinks(user.rol).map((link) => (
            <Link
              key={link.href}
              href={link.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className={itemClass}
            >
              {link.label}
            </Link>
          ))}
          <form action={logoutAction} className="border-outline-variant/20 mt-1 border-t pt-1">
            <button type="submit" role="menuitem" className={itemClass}>
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span>{copy.logout}</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
