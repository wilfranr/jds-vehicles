import { describe, it, expect, vi } from 'vitest';
import type { AuthUser } from '@/types/auth';
import { submitReservation, type SubmitReservationContext } from './submit-reservation';

const user: AuthUser = { id: 7, rol: 'CLIENTE', name: 'Carlos Gómez', email: 'c@example.com' };

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const created = {
  status: 'created' as const,
  reservation: {
    id: 55,
    codigoReserva: 'RES-2026-AB2C',
    vehiculoId: 3,
    usuarioId: 7,
    fechaExpiracion: null,
  },
};

function makeContext(overrides: Partial<SubmitReservationContext> = {}): SubmitReservationContext {
  return {
    messages: {
      notAvailable: 'Ya reservado',
      limitReached: 'Tope',
      invalidVehicle: 'Inválido',
      tooManyAttempts: 'Demasiados',
    },
    getFreshUser: vi.fn().mockResolvedValue(user),
    checkAllowed: vi.fn().mockReturnValue({ allowed: true, retryAfterSeconds: 0 }),
    recordAttempt: vi.fn(),
    createReservation: vi.fn().mockResolvedValue(created),
    getVehicleLabel: vi.fn().mockResolvedValue({ marca: 'Toyota', modelo: 'Corolla' }),
    getDealerPhone: vi.fn().mockResolvedValue('573202353168'),
    buildWhatsAppUrl: vi.fn().mockReturnValue('https://wa.me/573202353168?text=x'),
    saveWhatsappLink: vi.fn().mockResolvedValue(undefined),
    refreshCatalog: vi.fn(),
    ...overrides,
  };
}

describe('submitReservation', () => {
  it('éxito: reserva para el usuario de la sesión, guarda el enlace y redirige a la confirmación', async () => {
    const ctx = makeContext();
    const result = await submitReservation(form({ vehicleId: '3' }), ctx);

    expect(ctx.createReservation).toHaveBeenCalledWith({ userId: 7, vehicleId: 3 });
    expect(ctx.buildWhatsAppUrl).toHaveBeenCalledWith('573202353168', {
      marca: 'Toyota',
      modelo: 'Corolla',
      codigo: 'RES-2026-AB2C',
      nombre: 'Carlos Gómez',
    });
    expect(ctx.saveWhatsappLink).toHaveBeenCalledWith(55, 'https://wa.me/573202353168?text=x');
    expect(result).toEqual({ status: 'redirect', to: '/mi-cuenta/reservas/RES-2026-AB2C?nueva=1' });
  });

  it('ignora un userId (y cualquier otro campo) enviado en el formulario', async () => {
    const ctx = makeContext();
    await submitReservation(
      form({ vehicleId: '3', userId: '999', usuarioId: '999', id: '999' }),
      ctx
    );

    expect(ctx.createReservation).toHaveBeenCalledWith({ userId: 7, vehicleId: 3 });
    expect(ctx.checkAllowed).toHaveBeenCalledWith(7);
  });

  it.each(['', 'abc', '0', '-1', '1.5', '1e3', '4294967296', '99999999999999999999', ' 3'])(
    'vehicleId inválido (%j): no llega al límite ni al servicio',
    async (vehicleId) => {
      const ctx = makeContext();
      const result = await submitReservation(form({ vehicleId }), ctx);

      expect(result).toEqual({ status: 'state', state: { error: 'Inválido' } });
      expect(ctx.checkAllowed).not.toHaveBeenCalled();
      expect(ctx.createReservation).not.toHaveBeenCalled();
    }
  );

  it('sin vehicleId en el formulario → inválido', async () => {
    const result = await submitReservation(form({}), makeContext());
    expect(result).toEqual({ status: 'state', state: { error: 'Inválido' } });
  });

  it('orden: sesión → validación → límite → servicio', async () => {
    const calls: string[] = [];
    const ctx = makeContext({
      getFreshUser: vi.fn(async () => (calls.push('sesion'), user)),
      checkAllowed: vi.fn(() => (calls.push('limite'), { allowed: true, retryAfterSeconds: 0 })),
      createReservation: vi.fn(async () => (calls.push('servicio'), created)),
    });
    await submitReservation(form({ vehicleId: '3' }), ctx);
    expect(calls).toEqual(['sesion', 'limite', 'servicio']);
  });

  it('límite alcanzado: no llama al servicio', async () => {
    const ctx = makeContext({
      checkAllowed: vi.fn().mockReturnValue({ allowed: false, retryAfterSeconds: 60 }),
    });
    const result = await submitReservation(form({ vehicleId: '3' }), ctx);

    expect(result).toEqual({ status: 'state', state: { error: 'Demasiados' } });
    expect(ctx.createReservation).not.toHaveBeenCalled();
    expect(ctx.recordAttempt).not.toHaveBeenCalled();
  });

  it('cada intento permitido consume cupo', async () => {
    const ctx = makeContext();
    await submitReservation(form({ vehicleId: '3' }), ctx);
    expect(ctx.recordAttempt).toHaveBeenCalledWith(7);
  });

  it('sin sesión vigente (o usuario desactivado): no reserva y pide cerrar la sesión', async () => {
    const ctx = makeContext({ getFreshUser: vi.fn().mockResolvedValue(null) });
    expect(await submitReservation(form({ vehicleId: '3' }), ctx)).toEqual({ status: 'inactive' });
    expect(ctx.createReservation).not.toHaveBeenCalled();
  });

  it('inactive_user del servicio → cerrar sesión', async () => {
    const ctx = makeContext({
      createReservation: vi.fn().mockResolvedValue({ status: 'inactive_user' }),
    });
    expect(await submitReservation(form({ vehicleId: '3' }), ctx)).toEqual({ status: 'inactive' });
  });

  it('not_available: mensaje claro y refresca la caché para que la ficha muestre el estado actual', async () => {
    const ctx = makeContext({
      createReservation: vi.fn().mockResolvedValue({ status: 'not_available' }),
    });
    const result = await submitReservation(form({ vehicleId: '3' }), ctx);

    expect(result).toEqual({ status: 'state', state: { error: 'Ya reservado' } });
    expect(ctx.refreshCatalog).toHaveBeenCalledTimes(1);
    expect(ctx.saveWhatsappLink).not.toHaveBeenCalled();
  });

  it('already_reserved_by_you: lleva a la reserva existente (sin ?nueva)', async () => {
    const ctx = makeContext({
      createReservation: vi
        .fn()
        .mockResolvedValue({ status: 'already_reserved_by_you', codigoReserva: 'RES-2026-ZZ99' }),
    });
    expect(await submitReservation(form({ vehicleId: '3' }), ctx)).toEqual({
      status: 'redirect',
      to: '/mi-cuenta/reservas/RES-2026-ZZ99',
    });
  });

  it('limit_reached: explica el tope y ofrece el enlace a «Mis reservas»', async () => {
    const ctx = makeContext({
      createReservation: vi.fn().mockResolvedValue({ status: 'limit_reached' }),
    });
    expect(await submitReservation(form({ vehicleId: '3' }), ctx)).toEqual({
      status: 'state',
      state: { error: 'Tope', showReservationsLink: true },
    });
  });

  it('si falla guardar el enlace de WhatsApp, la reserva confirmada igualmente redirige', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const ctx = makeContext({ saveWhatsappLink: vi.fn().mockRejectedValue(new Error('db')) });
    const result = await submitReservation(form({ vehicleId: '3' }), ctx);

    expect(result).toEqual({ status: 'redirect', to: '/mi-cuenta/reservas/RES-2026-AB2C?nueva=1' });
    spy.mockRestore();
  });
});
