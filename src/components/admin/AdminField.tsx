import React from 'react';

export const adminInputClass =
  'bg-surface-container-low text-on-surface font-body-md focus-visible:ring-primary w-full rounded-lg border border-outline-variant/40 px-3 py-2.5 text-sm placeholder:text-outline focus-visible:ring-2 focus-visible:outline-none aria-[invalid=true]:border-error disabled:opacity-60';

interface AdminFieldProps {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: (props: { describedBy: string | undefined; invalid: boolean }) => React.ReactNode;
}

/** Campo con etiqueta, ayuda y error asociados por `aria-describedby`. */
export function AdminField({ id, label, error, hint, children }: AdminFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-label-md text-on-surface text-sm font-semibold">
        {label}
      </label>
      {children({ describedBy, invalid: Boolean(error) })}
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
