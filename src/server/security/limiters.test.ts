import { afterEach, describe, it, expect, vi } from 'vitest';
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

// Políticas finales (F5-05). Si cambia un umbral o una ventana, esta tabla y el README deben cambiar a la vez.
describe('políticas de limitación (umbral y ventana)', () => {
  afterEach(() => vi.useRealTimers());

  it('login: 5 fallos por correo+IP y 20 por IP en 15 minutos; un éxito solo reinicia el par', async () => {
    const l = await import('./limiters');
    for (let i = 0; i < 5; i++) {
      expect(l.checkLoginAllowed('a@x.test', '10.0.0.1').allowed).toBe(true);
      l.recordLoginFailure('A@x.test ', '10.0.0.1'); // el correo se normaliza
    }
    expect(l.checkLoginAllowed('a@x.test', '10.0.0.1').allowed).toBe(false);
    expect(l.checkLoginAllowed('b@x.test', '10.0.0.1').allowed).toBe(true); // otro correo, misma IP
    l.recordLoginSuccess('a@x.test', '10.0.0.1');
    expect(l.checkLoginAllowed('a@x.test', '10.0.0.1').allowed).toBe(true);

    // 20 fallos desde una IP con 20 correos distintos bloquean a esa IP entera
    for (let i = 0; i < 20; i++) l.recordLoginFailure(`u${i}@x.test`, '10.0.0.2');
    expect(l.checkLoginAllowed('nuevo@x.test', '10.0.0.2').allowed).toBe(false);
    expect(l.checkLoginAllowed('nuevo@x.test', '10.0.0.3').allowed).toBe(true);
  });

  it('registro: 5 intentos por IP y hora (válidos o no)', async () => {
    const l = await import('./limiters');
    for (let i = 0; i < 5; i++) {
      expect(l.checkRegisterAllowed('10.0.1.1').allowed).toBe(true);
      l.recordRegisterAttempt('10.0.1.1');
    }
    expect(l.checkRegisterAllowed('10.0.1.1').allowed).toBe(false);
    expect(l.checkRegisterAllowed('10.0.1.2').allowed).toBe(true);
  });

  it('subida de fotos: 30 envíos por persona y hora', async () => {
    const l = await import('./limiters');
    for (let i = 0; i < 30; i++) {
      expect(l.checkPhotoUploadAllowed(401).allowed).toBe(true);
      l.recordPhotoUploadAttempt(401);
    }
    const blocked = l.checkPhotoUploadAllowed(401);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(3600);
    expect(l.checkPhotoUploadAllowed(402).allowed).toBe(true);
  });

  it('las ventanas se vacían: tras 15 min / 1 h se permite de nuevo', async () => {
    vi.useFakeTimers();
    vi.resetModules(); // los limitadores capturan `Date.now` al crearse: se cargan ya con el reloj simulado
    const l = await import('./limiters');
    for (let i = 0; i < 5; i++) l.recordPasswordChangeFailure(501);
    for (let i = 0; i < 30; i++) l.recordPhotoUploadAttempt(501);
    expect(l.checkPasswordChangeAllowed(501).allowed).toBe(false);
    expect(l.checkPhotoUploadAllowed(501).allowed).toBe(false);
    vi.advanceTimersByTime(15 * 60_000 + 1000);
    expect(l.checkPasswordChangeAllowed(501).allowed).toBe(true);
    expect(l.checkPhotoUploadAllowed(501).allowed).toBe(false);
    vi.advanceTimersByTime(45 * 60_000 + 1000);
    expect(l.checkPhotoUploadAllowed(501).allowed).toBe(true);
  });
});
