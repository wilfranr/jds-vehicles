'use client';

import React, { useActionState } from 'react';
import { initialNameState, type NameFormState } from '@/server/admin/vehicle-form-state';

interface ToggleFormProps {
  action: (previous: NameFormState, formData: FormData) => Promise<NameFormState>;
  id: number;
  label: string;
}

/** Botón de activar/desactivar (marca o modelo); muestra el error si lo hay. */
export function ToggleForm({ action, id, label }: ToggleFormProps) {
  const [state, formAction, pending] = useActionState(action, initialNameState);
  return (
    <form action={formAction} className="flex flex-col gap-1">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        className="border-outline-variant/40 text-on-surface hover:bg-surface-container-low focus-visible:ring-primary rounded-lg border px-3 py-1.5 text-xs font-semibold focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60"
      >
        {label}
      </button>
      {state.error && (
        <p role="alert" className="text-error text-xs font-medium">
          {state.error}
        </p>
      )}
    </form>
  );
}
