import { describe, it, expect, vi } from 'vitest';
import { siteContent } from '@/lib/site-content';
import { createRegisterSchema } from '@/lib/validation/register';
import { createRateLimiter } from '@/server/security/rate-limit';
import { submitRegistration, type SubmitRegistrationContext } from './submit-registration';

const schema = createRegisterSchema(siteContent.registro.errors);

function form(overrides: Record<string, string> = {}): FormData {
  const data = new FormData();
  const fields: Record<string, string> = {
    nombre: 'Test',
    apellido: 'Limite',
    tipoDocumento: 'CC',
    documento: '77700011',
    email: 'limite@example.com',
    telefono: '3105551234',
    password: 'Clave-Segura1',
    confirmPassword: 'Clave-Segura1',
    consentimiento: 'on',
    ...overrides,
  };
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
}

function makeCtx(overrides: Partial<SubmitRegistrationContext> = {}) {
  const calls: string[] = [];
  const limiter = createRateLimiter({ limit: 5, windowMs: 3_600_000 });
  const ctx: SubmitRegistrationContext = {
    ip: '203.0.113.5',
    schema,
    messages: {
      errorSummary: 'resumen',
      duplicate: 'duplicado',
      config: 'config',
      tooManyAttempts: siteContent.auth.tooManyAttempts,
    },
    checkAllowed: (ip) => {
      calls.push('check');
      return limiter.check(ip);
    },
    recordAttempt: (ip) => {
      calls.push('record');
      limiter.hit(ip);
    },
    logEvent: vi.fn(),
    register: {
      findRoleIdByName: vi.fn(async () => 1),
      hashPassword: vi.fn(async (p: string) => {
        calls.push('hash');
        return `h:${p}`;
      }),
      createUser: vi.fn(async (d) => {
        calls.push('create');
        return { id: 1, email: d.email };
      }),
    },
    signIn: vi.fn(async () => {}),
    ...overrides,
  };
  return { ctx, calls, limiter };
}

describe('submitRegistration', () => {
  it('sigue el orden límite → validación → hash → creación', async () => {
    const { ctx, calls } = makeCtx();
    const result = await submitRegistration(form(), ctx);
    expect(result).toEqual({ status: 'registered' });
    expect(calls).toEqual(['check', 'record', 'hash', 'create']);
    expect(ctx.signIn).toHaveBeenCalledWith('limite@example.com', 'Clave-Segura1');
  });

  it('tras 5 envíos el sexto se rechaza sin ejecutar bcrypt ni crear filas', async () => {
    const { ctx } = makeCtx();
    for (let i = 0; i < 5; i++) {
      const r = await submitRegistration(
        form({ email: `l${i}@example.com`, documento: `7770001${i}` }),
        ctx
      );
      expect(r.status).toBe('registered');
    }
    vi.mocked(ctx.register.hashPassword).mockClear();
    vi.mocked(ctx.register.createUser).mockClear();

    const sixth = await submitRegistration(form({ email: 'sexto@example.com' }), ctx);
    expect(sixth.status).toBe('state');
    if (sixth.status === 'state') {
      expect(sixth.state.formError).toBe(siteContent.auth.tooManyAttempts);
      expect(sixth.state.values.nombre).toBe('Test');
    }
    expect(ctx.register.hashPassword).not.toHaveBeenCalled();
    expect(ctx.register.createUser).not.toHaveBeenCalled();
    expect(ctx.signIn).toHaveBeenCalledTimes(5);
    expect(ctx.logEvent).toHaveBeenCalledWith({ type: 'register_blocked', ip: '203.0.113.5' });
  });

  it('otra IP no se ve afectada por el bloqueo', async () => {
    const { ctx } = makeCtx();
    for (let i = 0; i < 5; i++)
      await submitRegistration(form({ email: `a${i}@example.com`, documento: `8880001${i}` }), ctx);
    const blocked = await submitRegistration(form({ email: 'z@example.com' }), ctx);
    expect(blocked.status).toBe('state');
    const other = await submitRegistration(
      form({ email: 'otra@example.com', documento: '99900022' }),
      { ...ctx, ip: '198.51.100.9' }
    );
    expect(other.status).toBe('registered');
  });

  it('los envíos inválidos y los duplicados también consumen cupo', async () => {
    const { ctx, limiter } = makeCtx();
    await submitRegistration(form({ nombre: 'A' }), ctx); // inválido
    ctx.register.createUser = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error('dup'), { code: 'P2002' }));
    await submitRegistration(form(), ctx); // duplicado
    // 2 intentos registrados: quedan 3 hasta el bloqueo
    for (let i = 0; i < 3; i++) limiter.hit(ctx.ip);
    expect(limiter.check(ctx.ip).allowed).toBe(false);
  });

  it('un envío bloqueado no valida: devuelve solo el mensaje genérico', async () => {
    const { ctx } = makeCtx({ checkAllowed: () => ({ allowed: false, retryAfterSeconds: 99 }) });
    const spy = vi.spyOn(ctx.schema, 'safeParse');
    const result = await submitRegistration(form({ nombre: 'A' }), ctx);
    expect(spy).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      status: 'state',
      state: { formError: siteContent.auth.tooManyAttempts, fieldErrors: {} },
    });
    expect(JSON.stringify(result)).not.toContain('99');
  });
});
