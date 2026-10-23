'use client';

import React, { startTransition, useActionState, useState } from 'react';
import { PAYMENT_METHODS } from '@/lib/validation/sale';
import { siteContent } from '@/lib/site-content';
import { initialSaleState, type SaleFormState } from '@/server/admin/sale-form-state';

const copy = siteContent.adminSales;

const inputClass =
  'bg-surface-container-low text-on-surface font-body-md focus-visible:ring-primary w-full rounded-lg border border-outline-variant/40 px-3 py-2.5 text-sm focus-visible:ring-2 focus-visible:outline-none aria-[invalid=true]:border-error';

interface SaleFormProps {
  action: (previous: SaleFormState, formData: FormData) => Promise<SaleFormState>;
  /** Precio del vehículo (editable), como texto decimal. */
  defaultPrice: string;
}

export function SaleForm({ action, defaultPrice }: SaleFormProps) {
  const [state, dispatch, pending] = useActionState(action, initialSaleState);
  const errors = state.fieldErrors;
  // Campos controlados: React reinicia los no controlados al terminar la acción y se perdería lo escrito tras un error.
  const [price, setPrice] = useState(defaultPrice);
  const [method, setMethod] = useState('TRANSFERENCIA');
  const [notes, setNotes] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  // Se envía a mano (en vez de `<form action>`) para que React NO reinicie el formulario al terminar la acción:
  // tras un error el usuario conserva lo escrito y la casilla de confirmación.
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => dispatch(data));
  }

  const error = (id: string, message?: string) =>
    message ? (
      <p id={`${id}-error`} className="text-error text-xs font-medium">
        {message}
      </p>
    ) : null;

  return (
    <form method="post" onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <p className="text-on-surface-variant text-sm">{copy.form.intro}</p>

      {state.error && (
        <p
          role="alert"
          className="bg-error-container text-on-error-container rounded-lg px-3 py-2 text-sm"
        >
          {state.error}
        </p>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="venta-precio" className="text-sm font-semibold">
          {copy.form.price}
        </label>
        <input
          id="venta-precio"
          name="precio"
          inputMode="decimal"
          maxLength={13}
          value={price}
          onChange={(event) => setPrice(event.target.value)}
          aria-invalid={Boolean(errors.precio)}
          aria-describedby={`venta-precio-hint${errors.precio ? ' venta-precio-error' : ''}`}
          className={inputClass}
        />
        <p id="venta-precio-hint" className="text-on-surface-variant text-xs">
          {copy.form.priceHint}
        </p>
        {error('venta-precio', errors.precio)}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="venta-metodo" className="text-sm font-semibold">
          {copy.form.method}
        </label>
        <select
          id="venta-metodo"
          name="metodoPago"
          value={method}
          onChange={(event) => setMethod(event.target.value)}
          aria-invalid={Boolean(errors.metodoPago)}
          aria-describedby={errors.metodoPago ? 'venta-metodo-error' : undefined}
          className={inputClass}
        >
          {PAYMENT_METHODS.map((method) => (
            <option key={method} value={method}>
              {copy.methodLabels[method]}
            </option>
          ))}
        </select>
        {error('venta-metodo', errors.metodoPago)}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="venta-obs" className="text-sm font-semibold">
          {copy.form.notes}
        </label>
        <textarea
          id="venta-obs"
          name="observaciones"
          rows={3}
          maxLength={1200}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          aria-invalid={Boolean(errors.observaciones)}
          aria-describedby={`venta-obs-hint${errors.observaciones ? ' venta-obs-error' : ''}`}
          className={inputClass}
        />
        <p id="venta-obs-hint" className="text-on-surface-variant text-xs">
          {copy.form.notesHint}
        </p>
        {error('venta-obs', errors.observaciones)}
      </div>

      <div className="flex flex-col gap-1">
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="confirmar"
            required
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            aria-invalid={Boolean(errors.confirmar)}
            aria-describedby={errors.confirmar ? 'venta-confirmar-error' : undefined}
            className="focus-visible:ring-primary mt-0.5 h-4 w-4 shrink-0 rounded focus-visible:ring-2 focus-visible:outline-none"
          />
          <span>{copy.form.confirm}</span>
        </label>
        {error('venta-confirmar', errors.confirmar)}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="bg-primary text-on-primary focus-visible:ring-primary self-start rounded-lg px-4 py-2.5 text-sm font-semibold hover:bg-neutral-800 focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60"
      >
        {pending ? copy.form.submitting : copy.form.submit}
      </button>
    </form>
  );
}
