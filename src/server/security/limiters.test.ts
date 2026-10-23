import { describe, it, expect } from 'vitest';
import {
  checkPasswordChangeAllowed,
  recordPasswordChangeFailure,
  recordPasswordChangeSuccess,
} from './limiters';

describe('limitador de cambio de contraseña', () => {
  it('bloquea al usuario tras 5 fallos y no afecta a otro', () => {
    for (let i = 0; i < 5; i++) {
      expect(checkPasswordChangeAllowed(101).allowed).toBe(true);
      recordPasswordChangeFailure(101);
    }
    expect(checkPasswordChangeAllowed(101).allowed).toBe(false);
    expect(checkPasswordChangeAllowed(102).allowed).toBe(true);
  });

  it('un cambio correcto reinicia el contador del usuario', () => {
    for (let i = 0; i < 4; i++) recordPasswordChangeFailure(103);
    recordPasswordChangeSuccess(103);
    recordPasswordChangeFailure(103);
    expect(checkPasswordChangeAllowed(103).allowed).toBe(true);
  });
});

describe('limitador de reservas', () => {
  it('permite 10 intentos por hora por usuario y no afecta a otros', async () => {
    const { checkReserveAllowed, recordReserveAttempt } = await import('./limiters');
    for (let i = 0; i < 10; i++) {
      expect(checkReserveAllowed(201).allowed).toBe(true);
      recordReserveAttempt(201);
    }
    expect(checkReserveAllowed(201).allowed).toBe(false);
    expect(checkReserveAllowed(202).allowed).toBe(true);
  });
});

describe('limitador de restablecimientos de contraseña por administrador', () => {
  it('permite 10 por hora por administrador y no afecta a otro', async () => {
    const { checkAdminResetAllowed, recordAdminReset } = await import('./limiters');
    for (let i = 0; i < 10; i++) {
      expect(checkAdminResetAllowed(301).allowed).toBe(true);
      recordAdminReset(301);
    }
    expect(checkAdminResetAllowed(301).allowed).toBe(false);
    expect(checkAdminResetAllowed(302).allowed).toBe(true);
  });
});
