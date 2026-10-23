import { describe, it, expect } from 'vitest';
import type { EstadoReserva } from '@prisma/client';
import { checkTransition, FINAL_STATES } from './transitions';

const ALL: EstadoReserva[] = [
  'PENDIENTE_CONTACTO',
  'EN_NEGOCIACION',
  'COMPLETADA',
  'CANCELADA',
  'EXPIRADA',
];

describe('checkTransition (máquina de estados del personal)', () => {
  it.each([
    ['PENDIENTE_CONTACTO', 'EN_NEGOCIACION'],
    ['PENDIENTE_CONTACTO', 'CANCELADA'],
    ['EN_NEGOCIACION', 'CANCELADA'],
  ] as const)('permite %s → %s', (from, to) => {
    expect(checkTransition(from, to)).toEqual({ ok: true });
  });

  it('las demás transiciones de botón se rechazan', () => {
    const allowed = new Set([
      'PENDIENTE_CONTACTO>EN_NEGOCIACION',
      'PENDIENTE_CONTACTO>CANCELADA',
      'EN_NEGOCIACION>CANCELADA',
    ]);
    for (const from of ALL) {
      for (const to of ALL) {
        if (allowed.has(`${from}>${to}`)) continue;
        expect(checkTransition(from, to).ok, `${from} → ${to}`).toBe(false);
      }
    }
  });

  it('los estados finales no cambian, ni siquiera con una venta', () => {
    for (const from of FINAL_STATES) {
      for (const to of ALL) {
        expect(checkTransition(from, to)).toEqual({ ok: false, reason: 'final_state' });
        expect(checkTransition(from, to, { viaSale: true })).toEqual({
          ok: false,
          reason: 'final_state',
        });
      }
    }
  });

  it('COMPLETADA solo vía venta y desde un estado activo', () => {
    expect(checkTransition('PENDIENTE_CONTACTO', 'COMPLETADA')).toEqual({
      ok: false,
      reason: 'not_allowed',
    });
    expect(checkTransition('EN_NEGOCIACION', 'COMPLETADA')).toEqual({
      ok: false,
      reason: 'not_allowed',
    });
    expect(checkTransition('PENDIENTE_CONTACTO', 'COMPLETADA', { viaSale: true })).toEqual({
      ok: true,
    });
    expect(checkTransition('EN_NEGOCIACION', 'COMPLETADA', { viaSale: true })).toEqual({
      ok: true,
    });
  });

  it('EXPIRADA no se produce a mano', () => {
    expect(checkTransition('PENDIENTE_CONTACTO', 'EXPIRADA').ok).toBe(false);
    expect(checkTransition('EN_NEGOCIACION', 'EXPIRADA', { viaSale: true }).ok).toBe(false);
  });

  it('mismo estado se rechaza', () => {
    expect(checkTransition('EN_NEGOCIACION', 'EN_NEGOCIACION')).toEqual({
      ok: false,
      reason: 'same_state',
    });
  });
});
