import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const requireStaff = vi.fn();
const registerSale = vi.fn();
const updateTag = vi.fn();

vi.mock('@/server/auth/staff', () => ({ requireStaff: (p: string) => requireStaff(p) }));
vi.mock('@/server/admin/sales', () => ({ registerSale: (...a: unknown[]) => registerSale(...a) }));
vi.mock('next/cache', () => ({ updateTag: (t: string) => updateTag(t), revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

import { siteContent } from '@/lib/site-content';
import { registerSaleAction } from './venta-actions';

const copy = siteContent.adminSales;
let output: string[];

beforeEach(() => {
  output = [];
  vi.spyOn(console, 'info').mockImplementation(
    (...a: unknown[]) => void output.push(a.map(String).join(' '))
  );
  requireStaff
    .mockReset()
    .mockResolvedValue({ id: 5, rol: 'ASESOR', name: 'Asesor', email: 'a@x.com' });
  registerSale.mockReset().mockResolvedValue({ status: 'ok', id: 31, receipt: 'VTA-2026-000007' });
  updateTag.mockReset();
});
afterEach(() => vi.restoreAllMocks());

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
}
const valid = { precio: '90000000', metodoPago: 'EFECTIVO', observaciones: '', confirmar: 'on' };

describe('registerSaleAction', () => {
  it('registra con el vendedor de la SESIÓN y redirige al recibo', async () => {
    await expect(
      registerSaleAction('RES-2026-AB2C', { fieldErrors: {}, values: {} }, form(valid))
    ).rejects.toThrow('REDIRECT:/admin/ventas/VTA-2026-000007');
    const [input] = registerSale.mock.calls[0]!;
    expect(input).toMatchObject({
      reservationCode: 'RES-2026-AB2C',
      sellerId: 5,
      sale: { precio: '90000000.00', metodoPago: 'EFECTIVO' },
    });
    expect(updateTag).toHaveBeenCalledWith('catalog-vehicles');
    expect(output.join('\n')).toContain('sale.registered');
  });

  it('ignora comprador/vendedor/ids enviados en el formulario', async () => {
    await expect(
      registerSaleAction(
        'RES-2026-AB2C',
        { fieldErrors: {}, values: {} },
        form({
          ...valid,
          compradorId: '999',
          vendedorId: '999',
          vendedorUsuarioId: '999',
          usuarioId: '999',
        })
      )
    ).rejects.toThrow('REDIRECT');
    const [input] = registerSale.mock.calls[0]!;
    expect(input.sellerId).toBe(5);
    expect(JSON.stringify(input)).not.toContain('999');
  });

  it('exige personal (requireStaff) antes de cualquier cosa', async () => {
    requireStaff.mockRejectedValue(new Error('NOT_FOUND'));
    await expect(
      registerSaleAction('RES-2026-AB2C', { fieldErrors: {}, values: {} }, form(valid))
    ).rejects.toThrow('NOT_FOUND');
    expect(registerSale).not.toHaveBeenCalled();
  });

  it('un código mal formado no llega al servicio', async () => {
    const state = await registerSaleAction('../etc', { fieldErrors: {}, values: {} }, form(valid));
    expect(state.error).toBe(copy.errors.notFound);
    expect(requireStaff).not.toHaveBeenCalled();
    expect(registerSale).not.toHaveBeenCalled();
  });

  it('datos inválidos → errores por campo y valores repoblados, sin llamar al servicio', async () => {
    const state = await registerSaleAction(
      'RES-2026-AB2C',
      { fieldErrors: {}, values: {} },
      form({ precio: '0', metodoPago: 'CHEQUE', observaciones: 'x'.repeat(1100) })
    );
    expect(state.fieldErrors).toMatchObject({
      precio: copy.errors.price,
      metodoPago: copy.errors.method,
      observaciones: copy.errors.notes,
      confirmar: copy.errors.confirm,
    });
    expect(state.values.precio).toBe('0');
    expect(registerSale).not.toHaveBeenCalled();
    expect(updateTag).not.toHaveBeenCalled();
  });

  it.each([
    [{ status: 'invalid_state', current: 'COMPLETADA' }, copy.errors.invalidState],
    [{ status: 'vehicle_invalid' }, copy.errors.vehicleInvalid],
    [{ status: 'not_found' }, copy.errors.notFound],
  ])('traduce %j a un aviso claro sin invalidar la caché', async (result, message) => {
    registerSale.mockResolvedValue(result);
    const state = await registerSaleAction(
      'RES-2026-AB2C',
      { fieldErrors: {}, values: {} },
      form(valid)
    );
    expect(state.error).toBe(message);
    expect(updateTag).not.toHaveBeenCalled();
  });

  it('el registro de auditoría no incluye al comprador ni datos personales', async () => {
    await registerSaleAction('RES-2026-AB2C', { fieldErrors: {}, values: {} }, form(valid)).catch(
      () => {}
    );
    const logged = JSON.parse(output[0]!);
    expect(logged).toMatchObject({
      channel: 'admin',
      action: 'sale.registered',
      actorId: 5,
      entityId: 31,
    });
    expect(JSON.stringify(logged)).not.toMatch(/@|compr|documento|tel/i);
  });
});
