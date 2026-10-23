import bcrypt from 'bcryptjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const requireAdmin = vi.fn();
const setUserPasswordHash = vi.fn();
const setUserActive = vi.fn();
const setUserRole = vi.fn();
const findUnique = vi.fn();

vi.mock('@/server/auth/staff', () => ({ requireAdmin: (p: string) => requireAdmin(p) }));
vi.mock('@/server/admin/users', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  setUserPasswordHash: (...a: unknown[]) => setUserPasswordHash(...a),
  setUserActive: (...a: unknown[]) => setUserActive(...a),
  setUserRole: (...a: unknown[]) => setUserRole(...a),
}));
vi.mock('@/lib/db', () => ({ prisma: { user: { findUnique: (a: unknown) => findUnique(a) } } }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { siteContent } from '@/lib/site-content';
import { createPasswordRule } from '@/lib/validation/register';
import { resetPasswordAction, setActiveAction, setRoleAction } from './actions';

const copy = siteContent.adminUsers;
const logs = ['log', 'info', 'warn', 'error', 'debug'] as const;
let output: string[];

beforeEach(() => {
  output = [];
  for (const level of logs) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      output.push(args.map(String).join(' '));
    });
  }
  requireAdmin
    .mockReset()
    .mockResolvedValue({ id: 1, rol: 'ADMIN', name: 'Admin', email: 'a@x.com' });
  setUserPasswordHash
    .mockReset()
    .mockImplementation(async (_a: number, id: number) => ({ status: 'ok', id }));
  setUserActive.mockReset();
  setUserRole.mockReset();
  findUnique.mockReset();
});
afterEach(() => vi.restoreAllMocks());

function form(fields: Record<string, string> = {}) {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
}

describe('resetPasswordAction', () => {
  it('genera una temporal que cumple la política, guarda solo su hash bcrypt (coste 12) y la devuelve una vez', async () => {
    const state = await resetPasswordAction(7, {}, form());

    expect(state.tempPassword).toBeDefined();
    expect(
      createPasswordRule(siteContent.registro.errors).safeParse(state.tempPassword).success
    ).toBe(true);
    const [actorId, targetId, hash] = setUserPasswordHash.mock.calls[0]!;
    expect([actorId, targetId]).toEqual([1, 7]);
    expect(hash).toMatch(/^\$2[aby]\$12\$/);
    expect(hash).not.toContain(state.tempPassword);
    expect(await bcrypt.compare(state.tempPassword!, hash as string)).toBe(true);
  });

  it('la contraseña temporal y su hash no aparecen en ningún log', async () => {
    const state = await resetPasswordAction(7, {}, form());
    const hash = setUserPasswordHash.mock.calls[0]![2] as string;

    const everything = output.join('\n');
    expect(everything).toContain('user_password_reset'); // sí se audita la acción…
    expect(everything).not.toContain(state.tempPassword!); // …pero nunca la clave
    expect(everything).not.toContain(hash);
    expect(everything).not.toMatch(/\$2[aby]\$/);
  });

  it('exige ADMIN (requireAdmin) antes de hacer nada y no filtra si falla', async () => {
    requireAdmin.mockRejectedValue(new Error('NOT_FOUND'));
    await expect(resetPasswordAction(7, {}, form())).rejects.toThrow('NOT_FOUND');
    expect(setUserPasswordHash).not.toHaveBeenCalled();
  });

  it('limita a 10 restablecimientos por hora por administrador', async () => {
    requireAdmin.mockResolvedValue({ id: 777, rol: 'ADMIN', name: 'Otro', email: 'o@x.com' });
    for (let i = 0; i < 10; i++)
      expect((await resetPasswordAction(7, {}, form())).tempPassword).toBeDefined();
    const blocked = await resetPasswordAction(7, {}, form());
    expect(blocked).toEqual({ error: copy.errors.tooMany });
    expect(setUserPasswordHash).toHaveBeenCalledTimes(10);
  });

  it('no permite restablecer la propia contraseña y no revela datos de otros', async () => {
    setUserPasswordHash.mockResolvedValue({ status: 'self_forbidden' });
    expect(await resetPasswordAction(1, {}, form())).toEqual({ error: copy.errors.selfForbidden });
    setUserPasswordHash.mockResolvedValue({ status: 'not_found' });
    expect(await resetPasswordAction(99999, {}, form())).toEqual({ error: copy.errors.generic });
  });

  it('un id enlazado inválido se rechaza sin llegar al servicio', async () => {
    for (const bad of [0, -1, 1.5, Number.NaN, 4_294_967_296]) {
      expect(await resetPasswordAction(bad, {}, form())).toEqual({ error: copy.errors.generic });
    }
    expect(setUserPasswordHash).not.toHaveBeenCalled();
  });
});

describe('setActiveAction y setRoleAction', () => {
  it('el actor sale siempre de la sesión; un campo actorId/userId del formulario se ignora', async () => {
    setUserActive.mockResolvedValue({ status: 'ok', id: 7, activeReservations: 0 });
    await setActiveAction(7, false, {}, form({ actorId: '999', userId: '999', id: '999' }));
    expect(setUserActive).toHaveBeenCalledWith(1, 7, false);
  });

  it('desactivar escribe user_deactivated y avisa de las reservas activas con un enlace', async () => {
    setUserActive.mockResolvedValue({ status: 'ok', id: 7, activeReservations: 2 });
    findUnique.mockResolvedValue({ email: 'cliente@example.com' });
    const state = await setActiveAction(7, false, {}, form());
    expect(state).toMatchObject({
      success: copy.deactivated,
      reservationsLinkEmail: 'cliente@example.com',
    });
    expect(output.join('\n')).toContain('user_deactivated');
  });

  it('las salvaguardas se traducen a avisos claros', async () => {
    setUserActive.mockResolvedValue({ status: 'self_forbidden' });
    expect(await setActiveAction(1, false, {}, form())).toEqual({
      error: copy.errors.selfForbidden,
    });
    setUserActive.mockResolvedValue({ status: 'last_admin' });
    expect(await setActiveAction(2, false, {}, form())).toEqual({ error: copy.errors.lastAdmin });
    setUserRole.mockResolvedValue({ status: 'last_admin' });
    expect(await setRoleAction(2, {}, form({ rol: 'CLIENTE' }))).toEqual({
      error: copy.errors.lastAdmin,
    });
  });

  it('el rol solo admite valores de la lista cerrada', async () => {
    for (const rol of ['SUPERADMIN', 'admin', '', 'ADMIN; DROP', '1']) {
      expect(await setRoleAction(7, {}, form({ rol }))).toEqual({ error: copy.errors.generic });
    }
    expect(await setRoleAction(7, {}, form())).toEqual({ error: copy.errors.generic });
    expect(setUserRole).not.toHaveBeenCalled();
  });

  it('cambiar el rol escribe user_role_changed con el rol, sin datos personales', async () => {
    setUserRole.mockResolvedValue({ status: 'ok', id: 7, activeReservations: 0 });
    expect(await setRoleAction(7, {}, form({ rol: 'ASESOR' }))).toEqual({
      success: copy.roleChanged,
    });
    expect(setUserRole).toHaveBeenCalledWith(1, 7, 'ASESOR');
    expect(output.join('\n')).toContain('user_role_changed');
  });
});
