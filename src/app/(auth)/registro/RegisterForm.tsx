'use client';

import React, { useActionState, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { siteContent } from '@/lib/site-content';
import type { LegalLink } from '@/lib/legal';
import {
  createRegisterSchema,
  fieldErrors as toFieldErrors,
  rawRegisterInput,
  type RegisterField,
} from '@/lib/validation/register';
import { registerAction } from './actions';
import { initialRegisterState } from './state';

const copy = siteContent.registro;
const schema = createRegisterSchema(copy.errors);

const inputClass =
  'bg-surface-container-low text-on-surface font-body-md focus-visible:ring-primary w-full rounded-lg border border-outline-variant/40 px-3 py-2.5 text-sm placeholder:text-outline focus-visible:ring-2 focus-visible:outline-none aria-[invalid=true]:border-error';

interface FieldProps {
  name: RegisterField;
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  children: (props: {
    id: string;
    describedBy: string | undefined;
    invalid: boolean;
  }) => React.ReactNode;
}

function Field({ name, label, error, hint, optional, children }: FieldProps) {
  const id = `registro-${name}`;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-label-md text-on-surface text-sm font-semibold">
        {label}
        {optional && (
          <span className="text-on-surface-variant ml-1 font-normal">{copy.optionalSuffix}</span>
        )}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint && (
        <p id={hintId} className="text-on-surface-variant text-xs">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-error text-xs font-medium">
          {error}
        </p>
      )}
    </div>
  );
}

export function RegisterForm({ legalLinks = [] }: { legalLinks?: LegalLink[] }) {
  const [state, formAction, pending] = useActionState(registerAction, initialRegisterState);
  // Los errores del cliente se asocian al estado del servidor vigente: al llegar uno nuevo dejan de aplicar.
  const [clientErrors, setClientErrors] = useState<{
    errors: typeof state.fieldErrors;
    forState: typeof state;
  } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Errores del cliente (UX) tienen prioridad hasta que el servidor responda de nuevo.
  const activeClientErrors = clientErrors?.forState === state ? clientErrors.errors : null;
  const errors = activeClientErrors ?? state.fieldErrors;
  const formError = activeClientErrors ? copy.errorSummary : state.formError;

  // Foco al primer campo con error, o al resumen si el error no es de un campo.
  useEffect(() => {
    const form = formRef.current;
    if (!form || !formError) return;
    const firstInvalid = form.querySelector<HTMLElement>('[aria-invalid="true"]');
    (firstInvalid ?? form.querySelector<HTMLElement>('[data-error-summary]'))?.focus();
  }, [errors, formError]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    // Mismo esquema que el servidor, solo para respuesta inmediata; el servidor sigue siendo la autoridad.
    const parsed = schema.safeParse(rawRegisterInput(new FormData(event.currentTarget)));
    if (!parsed.success) {
      event.preventDefault();
      setClientErrors({ errors: toFieldErrors(parsed.error), forState: state });
    }
  }

  const v = state.values;

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={handleSubmit}
      noValidate
      className="gap-space-md flex flex-col"
    >
      {formError && (
        <div
          role="alert"
          tabIndex={-1}
          data-error-summary
          className="bg-error-container text-on-error-container rounded-lg px-4 py-3 text-sm"
        >
          {formError}
        </div>
      )}

      <fieldset className="m-0 flex flex-col gap-4 border-0 p-0">
        <legend className="font-headline-sm text-on-surface mb-3 text-lg font-bold">
          {copy.sections.personal}
        </legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field name="nombre" label={copy.labels.nombre} error={errors.nombre}>
            {({ id, describedBy, invalid }) => (
              <input
                id={id}
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
          <Field name="apellido" label={copy.labels.apellido} error={errors.apellido}>
            {({ id, describedBy, invalid }) => (
              <input
                id={id}
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
          <Field
            name="tipoDocumento"
            label={copy.labels.tipoDocumento}
            error={errors.tipoDocumento}
          >
            {({ id, describedBy, invalid }) => (
              <select
                id={id}
                name="tipoDocumento"
                required
                defaultValue={v.tipoDocumento ?? 'CC'}
                aria-invalid={invalid}
                aria-describedby={describedBy}
                className={inputClass}
              >
                {copy.documentTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field
            name="documento"
            label={copy.labels.documento}
            error={errors.documento}
            hint={copy.hints.documento}
          >
            {({ id, describedBy, invalid }) => (
              <input
                id={id}
                name="documento"
                type="text"
                inputMode="text"
                autoComplete="off"
                required
                maxLength={100}
                defaultValue={v.documento}
                aria-invalid={invalid}
                aria-describedby={describedBy}
                className={inputClass}
              />
            )}
          </Field>
          <Field
            name="telefono"
            label={copy.labels.telefono}
            error={errors.telefono}
            hint={copy.hints.telefono}
          >
            {({ id, describedBy, invalid }) => (
              <input
                id={id}
                name="telefono"
                type="tel"
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
        </div>
      </fieldset>

      <fieldset className="m-0 flex flex-col gap-4 border-0 p-0">
        <legend className="font-headline-sm text-on-surface mb-3 text-lg font-bold">
          {copy.sections.account}
        </legend>
        <Field name="email" label={copy.labels.email} error={errors.email}>
          {({ id, describedBy, invalid }) => (
            <input
              id={id}
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={400}
              defaultValue={v.email}
              aria-invalid={invalid}
              aria-describedby={describedBy}
              className={inputClass}
            />
          )}
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            name="password"
            label={copy.labels.password}
            error={errors.password}
            hint={copy.hints.password}
          >
            {({ id, describedBy, invalid }) => (
              <input
                id={id}
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={10}
                maxLength={72}
                aria-invalid={invalid}
                aria-describedby={describedBy}
                className={inputClass}
              />
            )}
          </Field>
          <Field
            name="confirmPassword"
            label={copy.labels.confirmPassword}
            error={errors.confirmPassword}
          >
            {({ id, describedBy, invalid }) => (
              <input
                id={id}
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                maxLength={1000}
                aria-invalid={invalid}
                aria-describedby={describedBy}
                className={inputClass}
              />
            )}
          </Field>
        </div>
      </fieldset>

      <fieldset className="m-0 flex flex-col gap-4 border-0 p-0">
        <legend className="font-headline-sm text-on-surface mb-3 text-lg font-bold">
          {copy.sections.location}
        </legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field name="ciudad" label={copy.labels.ciudad} error={errors.ciudad} optional>
            {({ id, describedBy, invalid }) => (
              <input
                id={id}
                name="ciudad"
                type="text"
                autoComplete="address-level2"
                maxLength={300}
                defaultValue={v.ciudad}
                aria-invalid={invalid}
                aria-describedby={describedBy}
                className={inputClass}
              />
            )}
          </Field>
          <Field name="direccion" label={copy.labels.direccion} error={errors.direccion} optional>
            {({ id, describedBy, invalid }) => (
              <input
                id={id}
                name="direccion"
                type="text"
                autoComplete="street-address"
                maxLength={500}
                defaultValue={v.direccion}
                aria-invalid={invalid}
                aria-describedby={describedBy}
                className={inputClass}
              />
            )}
          </Field>
        </div>
      </fieldset>

      <div className="flex flex-col gap-1">
        <label className="flex items-start gap-3 text-sm">
          <input
            id="registro-consentimiento"
            name="consentimiento"
            type="checkbox"
            required
            aria-invalid={Boolean(errors.consentimiento)}
            aria-describedby={errors.consentimiento ? 'registro-consentimiento-error' : undefined}
            className="focus-visible:ring-primary mt-0.5 h-4 w-4 shrink-0 rounded focus-visible:ring-2 focus-visible:outline-none"
          />
          <span className="text-on-surface">{copy.consentimiento}</span>
        </label>
        {legalLinks.length > 0 && (
          <p className="text-on-surface-variant pl-7 text-sm">
            {siteContent.legal.consentSeeLabel}{' '}
            {legalLinks.map((link, index) => (
              <React.Fragment key={link.href}>
                {index > 0 && ' · '}
                <Link
                  href={link.href}
                  target="_blank"
                  className="text-secondary focus-visible:ring-primary rounded underline focus-visible:ring-2 focus-visible:outline-none"
                >
                  {link.label}
                </Link>
              </React.Fragment>
            ))}
          </p>
        )}
        {errors.consentimiento && (
          <p id="registro-consentimiento-error" className="text-error text-xs font-medium">
            {errors.consentimiento}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="bg-primary text-on-primary font-label-lg focus-visible:ring-primary w-full rounded-lg px-4 py-3 text-sm shadow-sm transition-colors hover:bg-neutral-800 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-60"
      >
        {pending ? copy.submitting : copy.submit}
      </button>

      <p className="text-on-surface-variant text-center text-sm">
        {copy.haveAccount} {/* /login lo crea F2-03; hasta entonces el enlace responde 404. */}
        <Link href="/login" className="text-secondary font-semibold hover:underline">
          {copy.loginLink}
        </Link>
      </p>
    </form>
  );
}
