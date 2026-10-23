import { describe, it, expect, vi } from 'vitest';
import { siteContent } from '@/lib/site-content';
import { createProfileSchema } from '@/lib/validation/register';
import type { AuthUser } from '@/types/auth';
import { submitProfileUpdate, type UpdateProfileContext } from './update-profile';

const user: AuthUser = { id: 7, rol: 'CLIENTE', name: 'Ana Pérez', email: 'ana@example.com' };

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const valid = {
  nombre: 'Ana',
  apellido: 'Pérez',
  telefono: '+57 310 555 1234',
  ciudad: 'Bogotá',
  direccion: '',
};

function makeContext(overrides: Partial<UpdateProfileContext> = {}): UpdateProfileContext {
  return {
    schema: createProfileSchema(siteContent.registro.errors),
    messages: { errorSummary: 'Revisa', saved: 'Guardado' },
    getFreshUser: vi.fn().mockResolvedValue(user),
    updateProfile: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('submitProfileUpdate', () => {
  it('guarda los datos normalizados del usuario de la sesión', async () => {
    const ctx = makeContext();
    const result = await submitProfileUpdate(form(valid), ctx);

    expect(ctx.updateProfile).toHaveBeenCalledWith(7, {
      nombre: 'Ana',
      apellido: 'Pérez',
      telefono: '573105551234',
      ciudad: 'Bogotá',
      direccion: undefined,
    });
    expect(result).toMatchObject({ status: 'state', state: { success: 'Guardado' } });
  });

  it('ignora un id (y otros campos) enviado en el formulario: usa siempre el de la sesión', async () => {
    const ctx = makeContext();
    await submitProfileUpdate(
      form({ ...valid, id: '999', userId: '999', email: 'otro@example.com', rolId: '3' }),
      ctx
    );

    expect(ctx.updateProfile).toHaveBeenCalledTimes(1);
    const [userId, data] = vi.mocked(ctx.updateProfile).mock.calls[0]!;
    expect(userId).toBe(7);
    expect(Object.keys(data).sort()).toEqual([
      'apellido',
      'ciudad',
      'direccion',
      'nombre',
      'telefono',
    ]);
  });

  it('con datos inválidos no guarda y devuelve errores por campo y los valores', async () => {
    const ctx = makeContext();
    const result = await submitProfileUpdate(form({ ...valid, telefono: '123' }), ctx);

    expect(ctx.updateProfile).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      status: 'state',
      state: {
        fieldErrors: { telefono: expect.any(String) },
        formError: 'Revisa',
        values: { telefono: '123', nombre: 'Ana' },
      },
    });
  });

  it('usuario desactivado o sin sesión: no guarda y pide cerrar la sesión', async () => {
    const ctx = makeContext({ getFreshUser: vi.fn().mockResolvedValue(null) });
    const result = await submitProfileUpdate(form(valid), ctx);

    expect(result).toEqual({ status: 'inactive' });
    expect(ctx.updateProfile).not.toHaveBeenCalled();
  });
});
