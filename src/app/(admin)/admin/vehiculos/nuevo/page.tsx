import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { VehicleForm } from '@/components/admin/VehicleForm';
import { siteContent } from '@/lib/site-content';
import { listSelectableModels } from '@/server/admin/vehicles';
import { requireStaff } from '@/server/auth/staff';
import { createVehicleAction } from '../actions';

const copy = siteContent.adminVehicles;

export const metadata: Metadata = { title: copy.newTitle };

export default async function NewVehiclePage() {
  await requireStaff('/admin/vehiculos/nuevo');
  const models = await listSelectableModels();

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Link
        href="/admin/vehiculos"
        className="text-secondary text-sm font-semibold hover:underline"
      >
        {copy.backToList}
      </Link>
      <h1 className="font-headline-xl text-on-surface text-3xl font-extrabold tracking-tight">
        {copy.newTitle}
      </h1>
      <VehicleForm action={createVehicleAction} models={models} vehicle={null} lock="none" />
    </div>
  );
}
