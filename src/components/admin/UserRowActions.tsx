'use client';

import React, { useActionState } from 'react';
import Link from 'next/link';
import { siteContent } from '@/lib/site-content';
import { initialUserActionState, type UserActionState } from '@/server/admin/user-form-state';

const copy = siteContent.adminUsers;
type Action = (previous: UserActionState, formData: FormData) => Promise<UserActionState>;

const buttonClass =
  'border-outline-variant/40 text-on-surface hover:bg-surface-container-low focus-visible:ring-primary rounded-lg border px-3 py-1.5 text-xs font-semibold focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60';

interface Props {
  userId: number;
  userName: string;
  isSelf: boolean;
  active: boolean;
  role: string;
  roles: { value: string; label: string }[];
  setRole: Action;
  setActive: Action;
  resetPassword: Action;
}

/**
 * Acciones de una fila. Permanece montado aunque la fila cambie (los avisos y la contraseña temporal no se
 * pierden al refrescar la lista).
 */
export function UserRowActions({
  userId,
  userName,
  isSelf,
  active,
  role,
  roles,
  setRole,
  setActive,
  resetPassword,
}: Props) {
  const [roleState, roleForm, rolePending] = useActionState(setRole, initialUserActionState);
  const [activeState, activeForm, activePending] = useActionState(
    setActive,
    initialUserActionState
  );
  const [resetState, resetForm, resetPending] = useActionState(
    resetPassword,
    initialUserActionState
  );
  const roleId = `rol-usuario-${userId}`;

  const messages = [roleState, activeState, resetState];
  return (
    <div className="flex min-w-[15rem] flex-col gap-2">
      <form action={roleForm} className="flex items-center gap-2">
        <label htmlFor={roleId} className="sr-only">
          {`${copy.roleSelectLabel} ${userName}`}
        </label>
        <select
          id={roleId}
          name="rol"
          defaultValue={role}
          className="bg-surface-container-low focus-visible:ring-primary border-outline-variant/40 rounded-lg border px-2 py-1.5 text-xs focus-visible:ring-2 focus-visible:outline-none"
        >
          {roles.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <button type="submit" disabled={rolePending} className={buttonClass}>
          {copy.changeRole}
        </button>
      </form>

      <div className="flex flex-wrap items-start gap-2">
        {!isSelf && (
          <form action={activeForm}>
            <button
              type="submit"
              disabled={activePending}
              aria-label={`${active ? copy.deactivate : copy.activate}: ${userName}`}
              className={buttonClass}
            >
              {active ? copy.deactivate : copy.activate}
            </button>
          </form>
        )}
        {!isSelf && (
          <details className="border-outline-variant/40 rounded-lg border">
            <summary
              aria-label={`${copy.resetPassword}: ${userName}`}
              className="focus-visible:ring-primary cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold focus-visible:ring-2 focus-visible:outline-none"
            >
              {copy.resetPassword}
            </summary>
            <form action={resetForm} className="flex max-w-xs flex-col gap-2 p-3 pt-1">
              <p className="text-on-surface-variant text-xs">{copy.resetIntro}</p>
              <button type="submit" disabled={resetPending} className={buttonClass}>
                {resetPending ? copy.working : copy.resetConfirm}
              </button>
            </form>
          </details>
        )}
      </div>

      {resetState.tempPassword && (
        <div
          role="status"
          className="bg-surface-container border-outline-variant/40 rounded-lg border p-3 text-xs"
        >
          <p className="font-semibold">{copy.tempPasswordTitle}</p>
          <p
            data-testid="temp-password"
            className="font-spec-numerical my-1 text-base font-bold break-all select-all"
          >
            {resetState.tempPassword}
          </p>
          <p className="text-on-surface-variant">{copy.tempPasswordHelp}</p>
        </div>
      )}
      {messages.map((state, index) => (
        <React.Fragment key={index}>
          {state.error && (
            <p role="alert" className="text-error text-xs font-medium">
              {state.error}
            </p>
          )}
          {state.success && !state.tempPassword && (
            <p role="status" className="text-on-surface text-xs font-medium">
              {state.success}
            </p>
          )}
          {state.reservationsLinkEmail && (
            <p className="text-xs">
              {copy.activeReservationsWarning}{' '}
              <Link
                href={`/admin/reservas?q=${encodeURIComponent(state.reservationsLinkEmail)}`}
                className="text-secondary font-semibold underline"
              >
                {copy.activeReservationsLink}
              </Link>
            </p>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
