import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { VehicleForm } from '@/components/admin/VehicleForm';
import { siteContent } from '@/lib/site-content';
import { parseVehicleId } from '@/lib/vehicle-id';
import { vehicleLock } from '@/server/admin/vehicle-rules';
import { getAdminVehicle, listSelectableModels } from '@/server/admin/vehicles';
import { requireStaff } from '@/server/auth/staff';
import { updateVehicleAction } from '../actions';

const copy = siteContent.adminVehicles;

export const metadata: Metadata = { title: copy.editTitle };

export default async function EditVehiclePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ creado?: string | string[] }>;
}) {
  const { id: rawId } = await params;
  const id = parseVehicleId(rawId);
  if (!id) notFound();

  await requireStaff(`/admin/vehiculos/${id}`);
  const vehicle = await getAdminVehicle(id);
  if (!vehicle) notFound();

  const [models, { creado }] = await Promise.all([
    listSelectableModels(vehicle.modeloId),
    searchParams,
  ]);
  const justCreated = (Array.isArray(creado) ? creado[0] : creado) === '1';

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Link
        href="/admin/vehiculos"
        className="text-secondary text-sm font-semibold hover:underline"
      >
        {copy.backToList}
      </Link>
      <h1 className="font-headline-xl text-on-surface text-3xl font-extrabold tracking-tight">
        {copy.editTitle}: {vehicle.marcaNombre} {vehicle.modeloNombre} {vehicle.anio}
      </h1>
      {justCreated && (
        <p
          role="status"
          className="bg-surface-container text-on-surface border-outline-variant/40 rounded-lg border px-4 py-3 text-sm font-medium"
        >
          {copy.created}
        </p>
      )}
      <VehicleForm
        action={updateVehicleAction.bind(null, vehicle.id)}
        models={models}
        vehicle={vehicle}
        lock={vehicleLock(vehicle)}
      />
    </div>
  );
}
