import type { EstadoReserva } from '@prisma/client';

export const FINAL_STATES: readonly EstadoReserva[] = ['COMPLETADA', 'CANCELADA', 'EXPIRADA'];

export type TransitionResult =
  { ok: true } | { ok: false; reason: 'final_state' | 'not_allowed' | 'same_state' };

/**
 * Transiciones que puede hacer el personal con un botón (decisión de F4-02):
 *  - `PENDIENTE_CONTACTO` → `EN_NEGOCIACION` | `CANCELADA`
 *  - `EN_NEGOCIACION` → `CANCELADA`
 * `COMPLETADA` solo la produce el registro de una venta (F4-05): se permite únicamente con `viaSale: true`,
 *  desde `PENDIENTE_CONTACTO` o `EN_NEGOCIACION`. `EXPIRADA` solo la produce el proceso de expiración.
 * Los estados finales no cambian.
 */
export function checkTransition(
  from: EstadoReserva,
  to: EstadoReserva,
  options: { viaSale?: boolean } = {}
): TransitionResult {
  if (FINAL_STATES.includes(from)) return { ok: false, reason: 'final_state' };
  if (from === to) return { ok: false, reason: 'same_state' };

  if (to === 'COMPLETADA') {
    return options.viaSale ? { ok: true } : { ok: false, reason: 'not_allowed' };
  }
  if (from === 'PENDIENTE_CONTACTO' && (to === 'EN_NEGOCIACION' || to === 'CANCELADA')) {
    return { ok: true };
  }
  if (from === 'EN_NEGOCIACION' && to === 'CANCELADA') return { ok: true };
  return { ok: false, reason: 'not_allowed' };
}
