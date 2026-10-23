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
