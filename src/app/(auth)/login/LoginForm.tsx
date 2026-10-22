'use client';

import React, { Suspense, useActionState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { siteContent } from '@/lib/site-content';
import { initialLoginState } from '@/server/auth/submit-login';
import { loginAction } from './actions';

const copy = siteContent.login;

const inputClass =
  'bg-surface-container-low text-on-surface font-body-md focus-visible:ring-primary w-full rounded-lg border border-outline-variant/40 px-3 py-2.5 text-sm placeholder:text-outline focus-visible:ring-2 focus-visible:outline-none';

/** Error que Auth.js añade a la URL (`/login?error=…`) cuando se redirige desde sus rutas. Requiere JavaScript. */
function UrlError() {
  const hasError = useSearchParams().has('error');
  if (!hasError) return null;
  return (
    <div
      role="alert"
      className="bg-error-container text-on-error-container rounded-lg px-4 py-3 text-sm"
    >
      {siteContent.auth.invalidCredentials}
    </div>
  );
}

/** Enlace a /registro que conserva `next`. Sin JavaScript queda el enlace simple de la versión estática. */
function RegisterLink() {
  const next = useSearchParams().get('next');
  const href = next ? `/registro?next=${encodeURIComponent(next)}` : '/registro';
  return <RegisterAnchor href={href} />;
}

function RegisterAnchor({ href }: { href: string }) {
  return (
    <Link href={href} className="text-secondary font-semibold hover:underline">
      {copy.registerLink}
    </Link>
  );
}

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialLoginState);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.formError) errorRef.current?.focus();
  }, [state]);

  return (
    <form action={formAction} className="gap-space-md flex flex-col">
      <Suspense fallback={null}>
        <UrlError />
      </Suspense>

      {state.formError && (
        <div
          ref={errorRef}
          role="alert"
          tabIndex={-1}
          className="bg-error-container text-on-error-container rounded-lg px-4 py-3 text-sm"
        >
          {state.formError}
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label
          htmlFor="login-email"
          className="font-label-md text-on-surface text-sm font-semibold"
        >
          {copy.labels.email}
        </label>
        <input
          id="login-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={400}
          defaultValue={state.values.email}
          aria-invalid={Boolean(state.formError)}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor="login-password"
          className="font-label-md text-on-surface text-sm font-semibold"
        >
          {copy.labels.password}
        </label>
        <input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          maxLength={1000}
          aria-invalid={Boolean(state.formError)}
          className={inputClass}
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="bg-primary text-on-primary font-label-lg focus-visible:ring-primary w-full rounded-lg px-4 py-3 text-sm shadow-sm transition-colors hover:bg-neutral-800 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-60"
      >
        {pending ? copy.submitting : copy.submit}
      </button>

      <p className="text-on-surface-variant text-center text-sm">
        {copy.noAccount}{' '}
        <Suspense fallback={<RegisterAnchor href="/registro" />}>
          <RegisterLink />
        </Suspense>
      </p>
    </form>
  );
}
