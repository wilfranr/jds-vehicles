'use client';

import React, { useActionState } from 'react';
import Image from 'next/image';
import { isLocalMedia, thumbOf } from '@/lib/media-url';
import { siteContent } from '@/lib/site-content';
import { initialActionState, type ActionState } from '@/server/admin/reservation-form-state';

const copy = siteContent.adminPhotos;
type Action = (previous: ActionState, formData: FormData) => Promise<ActionState>;

export interface PhotoRow {
  id: number;
  url: string;
  esPrincipal: boolean;
  position: number;
  total: number;
  setPrincipal: Action;
  moveUp: Action;
  moveDown: Action;
  remove: Action;
}

const buttonClass =
  'border-outline-variant/40 text-on-surface hover:bg-surface-container-low focus-visible:ring-primary rounded-lg border px-3 py-1.5 text-xs font-semibold focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50';

function PhotoItem({ photo }: { photo: PhotoRow }) {
  const [principalState, principalForm, principalPending] = useActionState(
    photo.setPrincipal,
    initialActionState
  );
  const [upState, upForm, upPending] = useActionState(photo.moveUp, initialActionState);
  const [downState, downForm, downPending] = useActionState(photo.moveDown, initialActionState);
  const [removeState, removeForm, removePending] = useActionState(photo.remove, initialActionState);
  const label = `${copy.photoAlt} ${photo.position}`;
  const local = isLocalMedia(photo.url);

  return (
    <li
      aria-label={label}
      data-photo-id={photo.id}
      className="bg-surface-container-lowest border-outline-variant/30 flex flex-col gap-3 rounded-2xl border p-3 sm:flex-row"
    >
      <div className="bg-surface-container relative aspect-[16/10] w-full shrink-0 overflow-hidden rounded-xl sm:w-44">
        <Image
          src={thumbOf(photo.url)}
          alt={label}
          fill
          sizes="(max-width: 640px) 100vw, 176px"
          unoptimized={local}
          className="object-cover"
        />
        {photo.esPrincipal && (
          <span className="bg-primary text-on-primary absolute top-2 left-2 rounded-full px-2.5 py-0.5 text-xs font-bold">
            {copy.principal}
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="text-on-surface-variant text-xs">
          {copy.position} {photo.position}
          {!local && ` · ${copy.external}`}
        </p>
        <div className="flex flex-wrap gap-2">
          {!photo.esPrincipal && (
            <form action={principalForm}>
              <button type="submit" disabled={principalPending} className={buttonClass}>
                {copy.makePrincipal}
              </button>
            </form>
          )}
          <form action={upForm}>
            <button
              type="submit"
              disabled={upPending || photo.position === 1}
              className={buttonClass}
            >
              {copy.moveUp}
            </button>
          </form>
          <form action={downForm}>
            <button
              type="submit"
              disabled={downPending || photo.position === photo.total}
              className={buttonClass}
            >
              {copy.moveDown}
            </button>
          </form>
          <details className="border-outline-variant/40 rounded-lg border">
            <summary className="focus-visible:ring-primary cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold focus-visible:ring-2 focus-visible:outline-none">
              {copy.remove}
            </summary>
            <form action={removeForm} className="flex flex-col gap-2 p-3 pt-1">
              <p className="text-on-surface-variant text-xs">{copy.removeHelp}</p>
              <button
                type="submit"
                disabled={removePending}
                className="bg-error text-on-error focus-visible:ring-error self-start rounded-lg px-3 py-1.5 text-xs font-semibold focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60"
              >
                {copy.removeConfirm}
              </button>
            </form>
          </details>
        </div>
        {[principalState, upState, downState, removeState].map((state, index) => (
          <React.Fragment key={index}>
            {state.error && (
              <p role="alert" className="text-error text-xs font-medium">
                {state.error}
              </p>
            )}
          </React.Fragment>
        ))}
      </div>
    </li>
  );
}

/** Lista de fotografías con sus acciones (principal, subir/bajar, eliminar). */
export function PhotoManager({ photos }: { photos: PhotoRow[] }) {
  return (
    <ul aria-label={copy.listLabel} className="flex flex-col gap-3">
      {photos.map((photo) => (
        <PhotoItem key={photo.id} photo={photo} />
      ))}
    </ul>
  );
}
