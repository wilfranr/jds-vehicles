import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PhotoManager } from '@/components/admin/PhotoManager';
import { VehicleForm } from '@/components/admin/VehicleForm';
import { siteContent } from '@/lib/site-content';
import { parseVehicleId } from '@/lib/vehicle-id';
import { listVehiclePhotos } from '@/server/admin/photos';
import { vehicleLock } from '@/server/admin/vehicle-rules';
import { getAdminVehicle, listSelectableModels } from '@/server/admin/vehicles';
import { requireStaff } from '@/server/auth/staff';
import { updateVehicleAction } from '../actions';
import { deletePhotoAction, movePhotoAction, setPrincipalAction } from './fotos-actions';

const copy = siteContent.adminVehicles;
const photoCopy = siteContent.adminPhotos;

const PHOTO_ERRORS = [
  'none',
  'tooManyFiles',
  'tooLarge',
  'notImage',
  'corrupt',
  'limit',
  'requestTooLarge',
  'notFound',
  'forbidden',
  'generic',
] as const;

type Raw = string | string[] | undefined;
const first = (value: Raw) => (Array.isArray(value) ? value[0] : value);

/** Mensaje de la subida a partir de la URL (solo códigos conocidos; `n` es un entero acotado). */
function photoMessage(raw: { foto?: Raw; fotoError?: Raw; n?: Raw }): {
  error?: string;
  ok?: string;
} {
  const rawN = first(raw.n);
  const n = rawN && /^\d{1,2}$/.test(rawN) ? Number(rawN) : 1;
  const code = PHOTO_ERRORS.find((c) => c === first(raw.fotoError));
  if (code) return { error: photoCopy.errors[code].replace('{n}', String(n)) };
  if (first(raw.foto) === 'subidas') {
    return {
      ok: n === 1 ? photoCopy.uploaded.one : photoCopy.uploaded.many.replace('{n}', String(n)),
    };
  }
  return {};
}

export const metadata: Metadata = { title: copy.editTitle };

export default async function EditVehiclePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ creado?: Raw; foto?: Raw; fotoError?: Raw; n?: Raw }>;
}) {
  const { id: rawId } = await params;
  const id = parseVehicleId(rawId);
  if (!id) notFound();

  await requireStaff(`/admin/vehiculos/${id}`);
  const vehicle = await getAdminVehicle(id);
  if (!vehicle) notFound();

  const [models, query, photos] = await Promise.all([
    listSelectableModels(vehicle.modeloId),
    searchParams,
    listVehiclePhotos(vehicle.id),
  ]);
  const { creado } = query;
  const message = photoMessage(query);
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

      <section
        aria-labelledby="fotos-titulo"
        className="border-outline-variant/30 flex flex-col gap-4 border-t pt-6"
      >
        <h2 id="fotos-titulo" className="font-headline-sm text-xl font-bold">
          {photoCopy.heading}
        </h2>
        <p className="text-on-surface-variant text-sm">{photoCopy.help}</p>

        {message.ok && (
          <p
            role="status"
            className="bg-surface-container text-on-surface border-outline-variant/40 rounded-lg border px-4 py-3 text-sm font-medium"
          >
            {message.ok}
          </p>
        )}
        {message.error && (
          <p
            role="alert"
            className="bg-error-container text-on-error-container rounded-lg px-4 py-3 text-sm"
          >
            {message.error}
          </p>
        )}

        {/* Formulario HTML estándar: funciona sin JavaScript y envía a la ruta de subida (multipart). */}
        <form
          method="post"
          action={`/admin/vehiculos/${vehicle.id}/fotos`}
          encType="multipart/form-data"
          className="flex flex-col gap-3"
        >
          <label htmlFor="fotos-input" className="text-sm font-semibold">
            {photoCopy.uploadLabel}
          </label>
          <input
            id="fotos-input"
            name="fotos"
            type="file"
            multiple
            required
            accept="image/jpeg,image/png,image/webp"
            className="border-outline-variant/40 bg-surface-container-low focus-visible:ring-primary w-full rounded-lg border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
          />
          <button
            type="submit"
            className="bg-primary text-on-primary focus-visible:ring-primary self-start rounded-lg px-4 py-2.5 text-sm font-semibold hover:bg-neutral-800 focus-visible:ring-2 focus-visible:outline-none"
          >
            {photoCopy.uploadSubmit}
          </button>
        </form>

        {photos.length === 0 ? (
          <p className="text-on-surface-variant text-sm">{photoCopy.empty}</p>
        ) : (
          <PhotoManager
            photos={photos.map((photo, index) => ({
              id: photo.id,
              url: photo.url,
              esPrincipal: photo.esPrincipal,
              position: index + 1,
              total: photos.length,
              setPrincipal: setPrincipalAction.bind(null, vehicle.id, photo.id),
              moveUp: movePhotoAction.bind(null, vehicle.id, photo.id, 'up'),
              moveDown: movePhotoAction.bind(null, vehicle.id, photo.id, 'down'),
              remove: deletePhotoAction.bind(null, vehicle.id, photo.id),
            }))}
          />
        )}
      </section>
    </div>
  );
}
