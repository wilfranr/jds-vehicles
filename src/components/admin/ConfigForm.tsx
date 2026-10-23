'use client';

import React, { useActionState, useState } from 'react';
import { siteContent } from '@/lib/site-content';
import { normalizeInstagramUrl, type ConfigKey } from '@/lib/validation/dealer-config';
import { normalizeColombianMobile } from '@/lib/validation/register';
import { buildWhatsAppUrl } from '@/lib/whatsapp';
import { initialConfigState, type ConfigFormState } from '@/server/admin/config-form-state';

const copy = siteContent.adminConfig;

const inputClass =
  'bg-surface-container-low text-on-surface font-body-md focus-visible:ring-primary w-full rounded-lg border border-outline-variant/40 px-3 py-2.5 text-sm focus-visible:ring-2 focus-visible:outline-none aria-[invalid=true]:border-error';

/** Enlace resultante del valor escrito (el mismo cálculo del servidor), o `null` si todavía no es válido. */
function previewUrl(key: ConfigKey, raw: string): string | null {
  if (key === 'whatsapp_numero') {
    const phone = normalizeColombianMobile(raw);
    return phone ? buildWhatsAppUrl(phone, siteContent.defaultWhatsAppMessage) : null;
  }
  return normalizeInstagramUrl(raw);
}

interface ConfigFormProps {
  configKey: ConfigKey;
  currentValue: string;
  isFallback: boolean;
  action: (previous: ConfigFormState, formData: FormData) => Promise<ConfigFormState>;
}

export function ConfigForm({ configKey, currentValue, isFallback, action }: ConfigFormProps) {
  const [state, formAction, pending] = useActionState(action, initialConfigState);
  const [value, setValue] = useState('');
  const labels = copy.keys[configKey];
  const preview = previewUrl(configKey, value);
  const id = `config-${configKey}`;

  return (
    <form
      action={formAction}
      aria-labelledby={`${id}-title`}
      className="bg-surface-container-lowest border-outline-variant/30 flex flex-col gap-4 rounded-2xl border p-4"
    >
      <h2 id={`${id}-title`} className="font-headline-sm text-lg font-bold">
        {labels.label}
      </h2>

      <p className="text-sm">
        <span className="text-on-surface-variant">{copy.current}: </span>
        <span className="font-spec-numerical font-semibold break-all">{currentValue}</span>
        {isFallback && (
          <span className="text-on-surface-variant block text-xs">{copy.fallbackNote}</span>
        )}
      </p>

      <div className="flex flex-col gap-1">
        <label htmlFor={id} className="text-sm font-semibold">
          {copy.newValue}
        </label>
        <input
          id={id}
          name="valor"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          maxLength={400}
          autoComplete="off"
          aria-describedby={`${id}-hint`}
          aria-invalid={Boolean(state.error)}
          className={inputClass}
        />
        <p id={`${id}-hint`} className="text-on-surface-variant text-xs">
          {labels.hint}
        </p>
      </div>

      <div className="bg-surface-container rounded-lg px-3 py-2 text-sm" aria-live="polite">
        <p className="font-semibold">{copy.preview}</p>
        {preview ? (
          <p className="break-all">
            <a
              href={preview}
              target="_blank"
              rel="noopener noreferrer"
              className="text-secondary font-semibold underline"
            >
              {copy.previewOpen}
            </a>{' '}
            <span data-testid={`${id}-preview`} className="font-spec-numerical text-xs">
              {preview}
            </span>
          </p>
        ) : (
          <p className="text-on-surface-variant">{copy.previewInvalid}</p>
        )}
      </div>

      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          name="confirmar"
          required
          className="focus-visible:ring-primary mt-0.5 h-4 w-4 shrink-0 rounded focus-visible:ring-2 focus-visible:outline-none"
        />
        <span>{labels.confirm}</span>
      </label>

      {state.error && (
        <p
          role="alert"
          className="bg-error-container text-on-error-container rounded-lg px-3 py-2 text-sm"
        >
          {state.error}
        </p>
      )}
      {state.success && (
        <p
          role="status"
          className="bg-surface-container text-on-surface rounded-lg px-3 py-2 text-sm font-medium"
        >
          {state.success}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="bg-primary text-on-primary focus-visible:ring-primary self-start rounded-lg px-4 py-2.5 text-sm font-semibold hover:bg-neutral-800 focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60"
      >
        {pending ? copy.saving : copy.save}
      </button>
    </form>
  );
}
