import React from 'react';
import type { Metadata } from 'next';
import { siteContent } from '@/lib/site-content';
import { RegisterForm } from './RegisterForm';

export const metadata: Metadata = {
  title: siteContent.registro.title,
  robots: { index: false, follow: false },
};

export default function RegistroPage() {
  return (
    <div className="px-gutter py-space-xl mx-auto w-full max-w-2xl">
      <div className="mb-6">
        <h1 className="font-headline-xl text-on-surface text-3xl font-extrabold tracking-tight">
          {siteContent.registro.heading}
        </h1>
        <p className="font-body-md text-on-surface-variant mt-1 text-sm">
          {siteContent.registro.subtitle}
        </p>
      </div>
      <div className="bg-surface-container-lowest border-outline-variant/30 p-space-lg rounded-2xl border shadow-sm">
        <RegisterForm />
      </div>
    </div>
  );
}
