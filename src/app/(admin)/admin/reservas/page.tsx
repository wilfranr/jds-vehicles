import React from 'react';
import type { Metadata } from 'next';
import { siteContent } from '@/lib/site-content';
import { requireStaff } from '@/server/auth/staff';

const title = siteContent.admin.sections.reservas;

export const metadata: Metadata = { title };

// Marcador de sección: lo reemplaza el issue de la Fase 4 correspondiente.
export default async function AdminReservasPage() {
  await requireStaff('/admin/reservas');

  return (
    <div>
      <h1 className="font-headline-xl text-on-surface text-3xl font-extrabold tracking-tight">
        {title}
      </h1>
      <p className="text-on-surface-variant mt-2 text-sm">{siteContent.admin.placeholder}</p>
    </div>
  );
}
