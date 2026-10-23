'use client';

import React, { useActionState } from 'react';
import { siteContent } from '@/lib/site-content';
import { initialChangePasswordState } from '@/server/account/change-password';
import { Field, inputClass } from '../Field';
import { changePasswordAction } from './actions';

const copy = siteContent.cuenta.security;

export function PasswordForm() {
  const [state, formAction, pending] = useActionState(
    changePasswordAction,
    initialChangePasswordState
  );
  const errors = state.fieldErrors;

  return (
    <form action={formAction} noValidate className="gap-space-md flex flex-col">
      {state.success && (
        <div
          role="status"
          className="bg-surface-container text-on-surface border-outline-variant/40 rounded-lg border px-4 py-3 text-sm font-medium"
        >
          {state.success}
        </div>
      )}
      {state.formError && (
        <div
          role="alert"
          className="bg-error-container text-on-error-container rounded-lg px-4 py-3 text-sm"
        >
          {state.formError}
        </div>
      )}

      <Field id="seg-actual" label={copy.labels.currentPassword} error={errors.currentPassword}>
        {({ describedBy, invalid }) => (
          <input
            id="seg-actual"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
            aria-invalid={invalid}
            aria-describedby={describedBy}
            className={inputClass}
          />
        )}
      </Field>
      <Field
        id="seg-nueva"
        label={copy.labels.newPassword}
        hint={copy.hints.newPassword}
        error={errors.newPassword}
      >
        {({ describedBy, invalid }) => (
          <input
            id="seg-nueva"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            required
            aria-invalid={invalid}
            aria-describedby={describedBy}
            className={inputClass}
          />
        )}
      </Field>
      <Field id="seg-confirmar" label={copy.labels.confirmPassword} error={errors.confirmPassword}>
        {({ describedBy, invalid }) => (
          <input
            id="seg-confirmar"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            aria-invalid={invalid}
            aria-describedby={describedBy}
            className={inputClass}
          />
        )}
      </Field>

      <button
        type="submit"
        disabled={pending}
        className="bg-primary text-on-primary font-label-lg focus-visible:ring-primary w-full rounded-lg px-4 py-3 text-sm shadow-sm transition-colors hover:bg-neutral-800 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-60 sm:w-auto sm:self-start"
      >
        {pending ? copy.submitting : copy.submit}
      </button>
    </form>
  );
}
