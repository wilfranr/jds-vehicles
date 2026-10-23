import { describe, it, expect, vi } from 'vitest';
import { siteContent } from '@/lib/site-content';
import { createChangePasswordSchema } from '@/lib/validation/account';
import type { AuthUser } from '@/types/auth';
import { submitChangePassword, type ChangePasswordContext } from './change-password';

const user: AuthUser = { id: 7, rol: 'CLIENTE', name: 'Ana Pérez', email: 'ana@example.com' };

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const valid = {
  currentPassword: 'Actual-Clave1',
  newPassword: 'Nueva-Clave-22',
  confirmPassword: 'Nueva-Clave-22',
};

function makeContext(overrides: Partial<ChangePasswordContext> = {}): ChangePasswordContext {
  return {
    ip: '1.2.3.4',
    schema: createChangePasswordSchema({
      currentRequired: 'Falta actual',
      password: siteContent.registro.errors,
    }),
    messages: {
      errorSummary: 'Revisa',
      currentWrong: 'Actual incorrecta',
      sameAsCurrent: 'Igual a la actual',
      tooManyAttempts: 'Demasiados intentos',
      changed: 'Cambiada',
    },
    getFreshUser: vi.fn().mockResolvedValue(user),
    checkAllowed: vi.fn().mockReturnValue({ allowed: true, retryAfterSeconds: 0 }),
    recordFailure: vi.fn(),
    recordSuccess: vi.fn(),
    logEvent: vi.fn(),
    getPasswordHash: vi.fn().mockResolvedValue('hash-actual'),
    comparePassword: vi.fn(async (plain: string) => plain === 'Actual-Clave1'),
    hashPassword: vi.fn().mockResolvedValue('hash-nuevo'),
    savePasswordHash: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('submitChangePassword', () => {
  it('éxito: guarda el hash nuevo del usuario de la sesión, reinicia el contador y registra el evento', async () => {
    const ctx = makeContext();
    const result = await submitChangePassword(form(valid), ctx);

    expect(ctx.hashPassword).toHaveBeenCalledWith('Nueva-Clave-22');
    expect(ctx.savePasswordHash).toHaveBeenCalledWith(7, 'hash-nuevo');
    expect(ctx.recordSuccess).toHaveBeenCalledWith(7);
    expect(ctx.logEvent).toHaveBeenCalledWith({
      type: 'password_changed',
      userId: 7,
      ip: '1.2.3.4',
    });
    expect(result).toMatchObject({ status: 'state', state: { success: 'Cambiada' } });
  });

  it('el evento registrado no contiene contraseñas ni hashes', async () => {
    const ctx = makeContext();
    await submitChangePassword(form(valid), ctx);
    const logged = JSON.stringify(vi.mocked(ctx.logEvent).mock.calls);
    for (const secret of ['Actual-Clave1', 'Nueva-Clave-22', 'hash-actual', 'hash-nuevo']) {
      expect(logged).not.toContain(secret);
    }
  });

  it('contraseña actual incorrecta: no guarda, consume cupo y registra el fallo', async () => {
    const ctx = makeContext();
    const result = await submitChangePassword(
      form({ ...valid, currentPassword: 'Mala-Clave-9' }),
      ctx
    );

    expect(ctx.savePasswordHash).not.toHaveBeenCalled();
    expect(ctx.recordFailure).toHaveBeenCalledWith(7);
    expect(ctx.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'password_change_failed', userId: 7 })
    );
    expect(result).toMatchObject({
      state: { fieldErrors: { currentPassword: 'Actual incorrecta' } },
    });
  });

  it('nueva igual a la actual: se rechaza sin guardar ni consumir cupo', async () => {
    const ctx = makeContext();
    const same = 'Actual-Clave1';
    const result = await submitChangePassword(
      form({ currentPassword: same, newPassword: same, confirmPassword: same }),
      ctx
    );

    expect(ctx.savePasswordHash).not.toHaveBeenCalled();
    expect(ctx.recordFailure).not.toHaveBeenCalled();
    expect(result).toMatchObject({ state: { fieldErrors: { newPassword: 'Igual a la actual' } } });
  });

  it('nueva débil: error de validación sin verificar la actual (no sirve de oráculo)', async () => {
    const ctx = makeContext();
    const result = await submitChangePassword(
      form({ ...valid, newPassword: 'corta1', confirmPassword: 'corta1' }),
      ctx
    );

    expect(ctx.comparePassword).not.toHaveBeenCalled();
    expect(ctx.savePasswordHash).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      state: { fieldErrors: { newPassword: expect.any(String) }, formError: 'Revisa' },
    });
  });

  it('confirmación distinta: no guarda', async () => {
    const ctx = makeContext();
    const result = await submitChangePassword(
      form({ ...valid, confirmPassword: 'Otra-Clave-33' }),
      ctx
    );
    expect(ctx.savePasswordHash).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      state: { fieldErrors: { confirmPassword: expect.any(String) } },
    });
  });

  it('usuario desactivado: no verifica ni guarda y pide cerrar la sesión', async () => {
    const ctx = makeContext({ getFreshUser: vi.fn().mockResolvedValue(null) });
    const result = await submitChangePassword(form(valid), ctx);

    expect(result).toEqual({ status: 'inactive' });
    expect(ctx.getPasswordHash).not.toHaveBeenCalled();
    expect(ctx.savePasswordHash).not.toHaveBeenCalled();
  });

  it('límite alcanzado: se rechaza aunque la contraseña actual sea correcta', async () => {
    const ctx = makeContext({
      checkAllowed: vi.fn().mockReturnValue({ allowed: false, retryAfterSeconds: 600 }),
    });
    const result = await submitChangePassword(form(valid), ctx);

    expect(ctx.comparePassword).not.toHaveBeenCalled();
    expect(ctx.savePasswordHash).not.toHaveBeenCalled();
    expect(ctx.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'password_change_blocked', userId: 7 })
    );
    expect(result).toMatchObject({ state: { formError: 'Demasiados intentos' } });
  });

  it('ignora un id enviado en el formulario: usa el de la sesión', async () => {
    const ctx = makeContext();
    await submitChangePassword(form({ ...valid, id: '999', userId: '999' }), ctx);

    expect(ctx.getPasswordHash).toHaveBeenCalledWith(7);
    expect(ctx.savePasswordHash).toHaveBeenCalledWith(7, 'hash-nuevo');
    expect(ctx.checkAllowed).toHaveBeenCalledWith(7);
  });
});
