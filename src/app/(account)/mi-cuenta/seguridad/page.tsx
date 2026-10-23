import React from 'react';
import type { Metadata } from 'next';
import { siteContent } from '@/lib/site-content';
import { requireUser } from '@/server/auth';
import { PasswordForm } from './PasswordForm';

const copy = siteContent.cuenta.security;

export const metadata: Metadata = { title: copy.title };

export default async function SecurityPage() {
  await requireUser('/mi-cuenta/seguridad');

  return (
    <section className="bg-surface-container-lowest border-outline-variant/30 p-space-lg rounded-2xl border shadow-sm">
      <h2 className="font-headline-sm text-on-surface text-lg font-bold">{copy.heading}</h2>
      <p className="font-body-md text-on-surface-variant mt-1 mb-4 text-sm">{copy.subtitle}</p>
      <PasswordForm />
    </section>
  );
}
