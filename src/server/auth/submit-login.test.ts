import { describe, it, expect, vi } from 'vitest';
import { siteContent } from '@/lib/site-content';
import { createRateLimiter } from '@/server/security/rate-limit';
import { submitLogin, type SubmitLoginContext } from './submit-login';

function form(email: string, password: string): FormData {
  const data = new FormData();
  data.set('email', email);
  data.set('password', password);
  return data;
}

function makeCtx(now: () => number, overrides: Partial<SubmitLoginContext> = {}) {
  const calls: string[] = [];
  const pair = createRateLimiter({ limit: 5, windowMs: 900_000, now });
  const ip = createRateLimiter({ limit: 20, windowMs: 900_000, now });
  const key = (email: string, addr: string) => `${email}|${addr}`;
  const ctx: SubmitLoginContext = {
    ip: '203.0.113.5',
    messages: {
      invalidCredentials: siteContent.auth.invalidCredentials,
      tooManyAttempts: siteContent.auth.tooManyAttempts,
    },
    checkAllowed: (email, addr) => {
      calls.push('check');
      const a = pair.check(key(email, addr));
      const b = ip.check(addr);
      return { allowed: a.allowed && b.allowed, retryAfterSeconds: 0 };
    },
    recordFailure: (email, addr) => {
      calls.push('failure');
      pair.hit(key(email, addr));
      ip.hit(addr);
    },
    recordSuccess: (email, addr) => {
      calls.push('success');
      pair.reset(key(email, addr));
    },
    logEvent: vi.fn(),
    authenticate: vi.fn(async (_email: string, password: string) => {
      calls.push('authenticate');
      return password === 'correcta';
    }),
    ...overrides,
  };
  return { ctx, calls };
}

describe('submitLogin', () => {
  it('éxito: límite → verificación → reinicio del par', async () => {
    const { ctx, calls } = makeCtx(Date.now);
    expect(await submitLogin(form('Ana@Example.com ', 'correcta'), ctx)).toEqual({
      status: 'authenticated',
    });
    expect(calls).toEqual(['check', 'authenticate', 'success']);
    expect(ctx.authenticate).toHaveBeenCalledWith('ana@example.com', 'correcta');
  });

  it('fallo: mensaje genérico, conserva solo el correo y registra login_failed enmascarado', async () => {
    const { ctx } = makeCtx(Date.now);
    const result = await submitLogin(form('ana@example.com', 'mala'), ctx);
    expect(result).toEqual({
      status: 'state',
      state: {
        formError: siteContent.auth.invalidCredentials,
        values: { email: 'ana@example.com' },
      },
    });
    expect(JSON.stringify(result)).not.toContain('mala');
    expect(ctx.logEvent).toHaveBeenCalledWith({
      type: 'login_failed',
      ip: '203.0.113.5',
      detail: 'a***@example.com',
    });
  });

  it('el sexto intento fallido del mismo correo+IP se bloquea aunque la contraseña sea correcta y se desbloquea con el tiempo', async () => {
    let t = 1_000_000;
    const { ctx, calls } = makeCtx(() => t);
    for (let i = 0; i < 5; i++) await submitLogin(form('ana@example.com', 'mala'), ctx);

    vi.mocked(ctx.authenticate).mockClear();
    calls.length = 0;
    const sixth = await submitLogin(form('ana@example.com', 'correcta'), ctx);
    expect(sixth).toMatchObject({
      status: 'state',
      state: { formError: siteContent.auth.tooManyAttempts },
    });
    expect(ctx.authenticate).not.toHaveBeenCalled();
    expect(calls).toEqual(['check']);
    expect(ctx.logEvent).toHaveBeenLastCalledWith({
      type: 'login_blocked',
      ip: '203.0.113.5',
      detail: 'a***@example.com',
    });

    t += 901_000; // pasa la ventana de 15 minutos
    expect(await submitLogin(form('ana@example.com', 'correcta'), ctx)).toEqual({
      status: 'authenticated',
    });
  });

  it('otro correo desde la misma IP no se bloquea por el par agotado', async () => {
    const { ctx } = makeCtx(Date.now);
    for (let i = 0; i < 5; i++) await submitLogin(form('ana@example.com', 'mala'), ctx);
    expect(await submitLogin(form('otro@example.com', 'correcta'), ctx)).toEqual({
      status: 'authenticated',
    });
  });

  it('tolera entradas ausentes o gigantes sin lanzar y acota la clave', async () => {
    const { ctx } = makeCtx(Date.now);
    const empty = await submitLogin(new FormData(), ctx);
    expect(empty.status).toBe('state');
    await submitLogin(form('x'.repeat(10_000), 'y'.repeat(10_000)), ctx);
    const emails = vi.mocked(ctx.authenticate).mock.calls.map((c) => c[0].length);
    expect(Math.max(...emails)).toBeLessThanOrEqual(150);
  });
});
