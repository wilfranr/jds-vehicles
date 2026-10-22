import { describe, it, expect } from 'vitest';
import { createRateLimiter } from './rate-limit';
import { checkLoginAllowed, recordLoginFailure, recordLoginSuccess } from './limiters';

function clock(start = 1_000_000) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

describe('createRateLimiter', () => {
  it('permite hasta el límite y bloquea el siguiente intento', () => {
    const c = clock();
    const rl = createRateLimiter({ limit: 3, windowMs: 60_000, now: c.now });
    for (let i = 0; i < 3; i++) {
      expect(rl.check('k').allowed).toBe(true);
      rl.hit('k');
    }
    const blocked = rl.check('k');
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(60);
  });

  it('check no consume cupo', () => {
    const rl = createRateLimiter({ limit: 1, windowMs: 1000 });
    for (let i = 0; i < 10; i++) expect(rl.check('k').allowed).toBe(true);
  });

  it('se desbloquea al pasar la ventana (ventana deslizante)', () => {
    const c = clock();
    const rl = createRateLimiter({ limit: 2, windowMs: 10_000, now: c.now });
    rl.hit('k');
    c.advance(4_000);
    rl.hit('k');
    expect(rl.check('k')).toEqual({ allowed: false, retryAfterSeconds: 6 });
    c.advance(6_000); // vence el primer intento
    expect(rl.check('k').allowed).toBe(true);
    c.advance(4_000); // vence también el segundo
    expect(rl.check('k').allowed).toBe(true);
    expect(rl.size()).toBe(0);
  });

  it('las claves distintas son independientes y reset libera una clave', () => {
    const rl = createRateLimiter({ limit: 1, windowMs: 60_000 });
    rl.hit('a');
    expect(rl.check('a').allowed).toBe(false);
    expect(rl.check('b').allowed).toBe(true);
    rl.reset('a');
    expect(rl.check('a').allowed).toBe(true);
  });

  it('no crece sin límite con 100 000 claves distintas', () => {
    const rl = createRateLimiter({ limit: 5, windowMs: 60_000, maxEntries: 1_000 });
    for (let i = 0; i < 100_000; i++) rl.hit(`ip-${i}`);
    expect(rl.size()).toBeLessThanOrEqual(1_000);
  });

  it('la limpieza periódica elimina claves vencidas', () => {
    const c = clock();
    const rl = createRateLimiter({ limit: 5, windowMs: 1_000, now: c.now });
    for (let i = 0; i < 50; i++) rl.hit(`k${i}`);
    c.advance(5_000);
    rl.hit('nueva');
    expect(rl.size()).toBe(1);
  });
});

describe('límites de login', () => {
  it('bloquea el sexto intento del par aunque la contraseña sea correcta y un éxito solo reinicia el par', () => {
    const email = 'limite@example.com';
    const ip = '203.0.113.9';
    for (let i = 0; i < 5; i++) {
      expect(checkLoginAllowed(email, ip).allowed).toBe(true);
      recordLoginFailure(email, ip);
    }
    const sixth = checkLoginAllowed(email, ip);
    expect(sixth.allowed).toBe(false);
    expect(sixth.retryAfterSeconds).toBeGreaterThan(0);

    // Otro correo desde la misma IP sigue permitido (la IP lleva 5 de 20).
    expect(checkLoginAllowed('otro@example.com', ip).allowed).toBe(true);

    recordLoginSuccess(email, ip);
    expect(checkLoginAllowed(email, ip).allowed).toBe(true);
  });

  it('normaliza el correo en la clave y bloquea la IP tras 20 fallos con correos distintos', () => {
    const ip = '203.0.113.50';
    for (let i = 0; i < 20; i++) recordLoginFailure(`user${i}@example.com`, ip);
    expect(checkLoginAllowed('nuevo@example.com', ip).allowed).toBe(false);
    // Un éxito no reinicia el contador de la IP.
    recordLoginSuccess('user0@example.com', ip);
    expect(checkLoginAllowed('nuevo@example.com', ip).allowed).toBe(false);
    expect(checkLoginAllowed('nuevo@example.com', '203.0.113.51').allowed).toBe(true);
  });
});
