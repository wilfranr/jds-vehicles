import React from 'react';
import type { Metadata } from 'next';
import { formatCOP } from '@/lib/format';
import { siteContent } from '@/lib/site-content';
import { getDashboardCounters } from '@/server/admin/dashboard';
import { requireStaff } from '@/server/auth/staff';
import type { Disponibilidad } from '@prisma/client';

const copy = siteContent.admin.dashboard;

export const metadata: Metadata = { title: copy.title };

const AVAILABILITY_ORDER: Disponibilidad[] = ['DISPONIBLE', 'RESERVADO', 'PROXIMAMENTE', 'VENDIDO'];

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-surface-container-lowest border-outline-variant/30 rounded-2xl border p-4 shadow-sm">
      <dt className="text-on-surface-variant text-sm">{label}</dt>
      <dd className="font-headline-md text-on-surface mt-1 text-3xl font-extrabold tabular-nums">
        {value}
      </dd>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <h2 className="font-headline-sm text-on-surface text-lg font-bold">{title}</h2>
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</dl>
    </section>
  );
}

export default async function AdminDashboardPage() {
  const user = await requireStaff('/admin');
  const counters = await getDashboardCounters(new Date(), { includeUsers: user.rol === 'ADMIN' });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-headline-xl text-on-surface text-3xl font-extrabold tracking-tight">
          {copy.title}
        </h1>
        <p className="text-on-surface-variant mt-1 text-sm">{copy.subtitle}</p>
      </div>

      <Group title={copy.vehiclesHeading}>
        {AVAILABILITY_ORDER.map((status) => (
          <Stat key={status} label={copy.vehicleLabels[status]} value={counters.vehicles[status]} />
        ))}
      </Group>

      <Group title={copy.reservationsHeading}>
        <Stat label={copy.activeReservations} value={counters.reservations.active} />
        <Stat label={copy.expiringReservations} value={counters.reservations.expiringIn24h} />
      </Group>

      <Group title={copy.salesHeading}>
        <Stat label={copy.salesCount} value={counters.sales.monthCount} />
        <Stat label={copy.salesTotal} value={formatCOP(counters.sales.monthTotal)} />
      </Group>

      {counters.activeUsers !== null && (
        <Group title={copy.usersHeading}>
          <Stat label={copy.activeUsers} value={counters.activeUsers} />
        </Group>
      )}
    </div>
  );
}
