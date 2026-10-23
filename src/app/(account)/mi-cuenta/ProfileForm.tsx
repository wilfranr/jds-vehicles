'use client';

import React, { useActionState } from 'react';
import { siteContent } from '@/lib/site-content';
import { initialProfileState } from '@/server/account/update-profile';
import type { AccountProfile } from '@/server/account/profile';
import { updateProfileAction } from './actions';
import { Field, inputClass } from './Field';

const copy = siteContent.cuenta.profile;
const labels = siteContent.registro.labels;

export function ProfileForm({ profile }: { profile: AccountProfile }) {
  const [state, formAction, pending] = useActionState(updateProfileAction, initialProfileState);
  const hasValues = Object.keys(state.values).length > 0;
  const v = hasValues ? state.values : profile;
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

      <fieldset className="m-0 flex flex-col gap-4 border-0 p-0">
        <legend className="font-headline-sm text-on-surface mb-3 text-lg font-bold">
          {copy.editableHeading}
        </legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="perfil-nombre" label={labels.nombre} error={errors.nombre}>
            {({ describedBy, invalid }) => (
              <input
                id="perfil-nombre"
                name="nombre"
                type="text"
                autoComplete="given-name"
                required
                maxLength={100}
                defaultValue={v.nombre}
                aria-invalid={invalid}
                aria-describedby={describedBy}
                className={inputClass}
              />
            )}
          </Field>
          <Field id="perfil-apellido" label={labels.apellido} error={errors.apellido}>
            {({ describedBy, invalid }) => (
              <input
                id="perfil-apellido"
                name="apellido"
                type="text"
                autoComplete="family-name"
                required
                maxLength={100}
                defaultValue={v.apellido}
                aria-invalid={invalid}
                aria-describedby={describedBy}
                className={inputClass}
              />
            )}
          </Field>
        </div>
        <Field
          id="perfil-telefono"
          label={labels.telefono}
          hint={siteContent.registro.hints.telefono}
          error={errors.telefono}
        >
          {({ describedBy, invalid }) => (
            <input
              id="perfil-telefono"
              name="telefono"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              required
              maxLength={60}
              defaultValue={v.telefono}
              aria-invalid={invalid}
              aria-describedby={describedBy}
              className={inputClass}
            />
          )}
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            id="perfil-ciudad"
            label={`${labels.ciudad} ${siteContent.registro.optionalSuffix}`}
            error={errors.ciudad}
          >
            {({ describedBy, invalid }) => (
              <input
                id="perfil-ciudad"
                name="ciudad"
                type="text"
                autoComplete="address-level2"
                maxLength={100}
                defaultValue={v.ciudad ?? ''}
                aria-invalid={invalid}
                aria-describedby={describedBy}
                className={inputClass}
              />
            )}
          </Field>
          <Field
            id="perfil-direccion"
            label={`${labels.direccion} ${siteContent.registro.optionalSuffix}`}
            error={errors.direccion}
          >
            {({ describedBy, invalid }) => (
              <input
                id="perfil-direccion"
                name="direccion"
                type="text"
                autoComplete="street-address"
                maxLength={255}
                defaultValue={v.direccion ?? ''}
                aria-invalid={invalid}
                aria-describedby={describedBy}
                className={inputClass}
              />
            )}
          </Field>
        </div>
      </fieldset>

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
