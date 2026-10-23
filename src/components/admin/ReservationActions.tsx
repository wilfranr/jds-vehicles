'use client';

import React, { useActionState } from 'react';
import { siteContent } from '@/lib/site-content';
import { initialActionState, type ActionState } from '@/server/admin/reservation-form-state';

const copy = siteContent.adminReservations;

const adminInputClass =
  'bg-surface-container-low text-on-surface font-body-md focus-visible:ring-primary w-full rounded-lg border border-outline-variant/40 px-3 py-2.5 text-sm focus-visible:ring-2 focus-visible:outline-none';
type Action = (previous: ActionState, formData: FormData) => Promise<ActionState>;

function Feedback({ state }: { state: ActionState }) {
  return (
    <>
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
    </>
  );
}

/**
 * Acciones de estado. El panel permanece montado aunque la reserva cambie de estado (los botones aparecen o
 * desaparecen según `canNegotiate` / `canCancel`), así los avisos de éxito o de error no se pierden al refrescar.
 */
export function ReservationActionsPanel({
  canNegotiate,
  canCancel,
  startAction,
  cancelAction,
}: {
  canNegotiate: boolean;
  canCancel: boolean;
  startAction: Action;
  cancelAction: Action;
}) {
  const [startState, startForm, startPending] = useActionState(startAction, initialActionState);
  const [cancelState, cancelForm, cancelPending] = useActionState(cancelAction, initialActionState);

  return (
    <div className="flex flex-col gap-3">
      {!canNegotiate && !canCancel && (
        <p className="text-on-surface-variant text-sm">{copy.finalState}</p>
      )}

      {canNegotiate && (
        <form action={startForm}>
          <button
            type="submit"
            disabled={startPending}
            className="bg-primary text-on-primary focus-visible:ring-primary rounded-lg px-4 py-2.5 text-sm font-semibold hover:bg-neutral-800 focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60"
          >
            {startPending ? copy.working : copy.startNegotiation}
          </button>
        </form>
      )}
      <Feedback state={startState} />

      {canCancel && (
        <details className="border-outline-variant/40 rounded-lg border">
          <summary className="focus-visible:ring-primary cursor-pointer rounded-lg px-4 py-2.5 text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none">
            {copy.cancelReservation}
          </summary>
          <form action={cancelForm} className="flex flex-col gap-3 p-4 pt-2">
            <div className="flex flex-col gap-1">
              <label htmlFor="cancel-motivo" className="text-sm font-semibold">
                {copy.cancelReasonLabel}
              </label>
              <textarea
                id="cancel-motivo"
                name="motivo"
                rows={3}
                maxLength={500}
                aria-describedby="cancel-motivo-hint"
                className={adminInputClass}
              />
              <p id="cancel-motivo-hint" className="text-on-surface-variant text-xs">
                {copy.cancelReasonHint}
              </p>
            </div>
            <button
              type="submit"
              disabled={cancelPending}
              className="bg-error text-on-error focus-visible:ring-error self-start rounded-lg px-4 py-2.5 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-60"
            >
              {cancelPending ? copy.working : copy.cancelConfirm}
            </button>
          </form>
        </details>
      )}
      <Feedback state={cancelState} />
    </div>
  );
}

/** Observaciones internas. */
export function NotesForm({ action, initial }: { action: Action; initial: string }) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <label htmlFor="reserva-obs" className="text-sm font-semibold">
        {copy.notesLabel}
      </label>
      <textarea
        id="reserva-obs"
        name="observaciones"
        rows={4}
        maxLength={1200}
        defaultValue={initial}
        aria-describedby="reserva-obs-hint"
        className={adminInputClass}
      />
      <p id="reserva-obs-hint" className="text-on-surface-variant text-xs">
        {copy.notesHint}
      </p>
      <button
        type="submit"
        disabled={pending}
        className="border-outline-variant/40 text-on-surface hover:bg-surface-container-low focus-visible:ring-primary self-start rounded-lg border px-4 py-2.5 text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60"
      >
        {pending ? copy.notesSaving : copy.notesSave}
      </button>
      <Feedback state={state} />
    </form>
  );
}
