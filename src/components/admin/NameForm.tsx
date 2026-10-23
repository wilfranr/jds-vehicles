'use client';

import React, { useActionState } from 'react';
import { initialNameState, type NameFormState } from '@/server/admin/vehicle-form-state';
import { adminInputClass } from './AdminField';

interface NameFormProps {
  action: (previous: NameFormState, formData: FormData) => Promise<NameFormState>;
  label: string;
  submitLabel: string;
  defaultValue?: string;
  /** Campos ocultos (p. ej. el id que se renombra). */
  hidden?: Record<string, string | number>;
  inputId: string;
}

/** Formulario de una línea (nombre + botón) para crear o renombrar marcas y modelos. */
export function NameForm({
  action,
  label,
  submitLabel,
  defaultValue,
  hidden,
  inputId,
}: NameFormProps) {
  const [state, formAction, pending] = useActionState(action, initialNameState);
  const errorId = `${inputId}-error`;

  return (
    <form action={formAction} className="flex flex-col gap-1">
      {Object.entries(hidden ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1 basis-40">
          <label htmlFor={inputId} className="sr-only">
            {label}
          </label>
          <input
            id={inputId}
            name="nombre"
            defaultValue={defaultValue}
            placeholder={label}
            maxLength={150}
            aria-invalid={Boolean(state.error)}
            aria-describedby={state.error ? errorId : undefined}
            className={adminInputClass}
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="border-outline-variant/40 text-on-surface hover:bg-surface-container-low focus-visible:ring-primary rounded-lg border px-3 py-2.5 text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60"
        >
          {submitLabel}
        </button>
      </div>
      {state.error && (
        <p id={errorId} role="alert" className="text-error text-xs font-medium">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="text-on-surface-variant text-xs">
          {state.success}
        </p>
      )}
    </form>
  );
}
