import { siteContent } from '@/lib/site-content';
import type { AuthUser } from '@/types/auth';

const copy = siteContent.account;
const MAX_NAME_LENGTH = 14;

// Fuera de `UserMenu.tsx` (que es 'use client'): los componentes de servidor no pueden llamar funciones
// exportadas desde un módulo de cliente.
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
