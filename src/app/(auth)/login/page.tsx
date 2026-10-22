import React from 'react';
import type { Metadata } from 'next';
import { siteContent } from '@/lib/site-content';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = {
  title: siteContent.login.title,
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <div className="px-gutter py-space-xl mx-auto w-full max-w-md">
      <div className="mb-6">
        <h1 className="font-headline-xl text-on-surface text-3xl font-extrabold tracking-tight">
          {siteContent.login.heading}
        </h1>
        <p className="font-body-md text-on-surface-variant mt-1 text-sm">
          {siteContent.login.subtitle}
        </p>
      </div>
      <div className="bg-surface-container-lowest border-outline-variant/30 p-space-lg rounded-2xl border shadow-sm">
        <LoginForm />
      </div>
    </div>
  );
}
