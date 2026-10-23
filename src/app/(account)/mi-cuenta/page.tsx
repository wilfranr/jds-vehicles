import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { siteContent } from '@/lib/site-content';
import { getProfile } from '@/server/account/profile';
import { requireUser } from '@/server/auth';
import { ProfileForm } from './ProfileForm';

const copy = siteContent.cuenta.profile;

export const metadata: Metadata = { title: copy.title };

export default async function ProfilePage() {
  const user = await requireUser('/mi-cuenta');
  const profile = await getProfile(user.id);
  // Cuenta desactivada o eliminada con la sesión aún vigente: sin datos que mostrar.
  if (!profile) notFound();

  return (
    <div className="gap-space-lg flex flex-col">
      <section className="bg-surface-container-lowest border-outline-variant/30 p-space-lg rounded-2xl border shadow-sm">
        <h2 className="font-headline-sm text-on-surface text-lg font-bold">{copy.heading}</h2>
        <p className="font-body-md text-on-surface-variant mt-1 mb-4 text-sm">{copy.subtitle}</p>
        <ProfileForm profile={profile} />
      </section>

      <section className="bg-surface-container-lowest border-outline-variant/30 p-space-lg rounded-2xl border shadow-sm">
        <h2 className="font-headline-sm text-on-surface text-lg font-bold">{copy.fixedHeading}</h2>
        <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-on-surface-variant">{copy.fixedLabels.documento}</dt>
            <dd className="text-on-surface font-medium">
              {profile.tipoDocumento} {profile.documentoIdentidad}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-on-surface-variant">{copy.fixedLabels.email}</dt>
            <dd className="text-on-surface font-medium break-words">{profile.email}</dd>
          </div>
        </dl>
        <p className="text-on-surface-variant mt-4 text-sm">
          {copy.fixedHelp}{' '}
          <Link href="/contacto" className="text-secondary font-semibold hover:underline">
            {copy.contactLink}
          </Link>
        </p>
      </section>
    </div>
  );
}
