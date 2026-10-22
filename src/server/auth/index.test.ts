import { describe, it, expect, vi, beforeEach } from 'vitest';

const authMock = vi.fn();
vi.mock('@/auth', () => ({ auth: () => authMock() }));
vi.mock('@/lib/db', () => ({ prisma: {} }));
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  // `cache` solo existe en el entorno de componentes de servidor; aquí se evita memorizar entre pruebas.
  cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
  notFound: () => {
    throw new Error('NOT_FOUND');
  },
}));

import { getCurrentUser, requireRole, requireUser } from './index';

beforeEach(() => authMock.mockReset());

describe('comprobaciones dentro de la acción (sin depender del proxy)', () => {
  it('requireUser sin sesión redirige a /login con la ruta de retorno', async () => {
    authMock.mockResolvedValue(null);
    await expect(requireUser('/mi-cuenta')).rejects.toThrow('REDIRECT:/login?next=%2Fmi-cuenta');
  });

  it('requireUser descarta rutas de retorno externas', async () => {
    authMock.mockResolvedValue(null);
    await expect(requireUser('//evil.com')).rejects.toThrow('REDIRECT:/login?next=%2F');
  });

  it('requireRole sin sesión redirige y con rol insuficiente responde 404', async () => {
    authMock.mockResolvedValue(null);
    await expect(requireRole(['ADMIN'], '/admin')).rejects.toThrow('REDIRECT:/login');

    authMock.mockResolvedValue({
      user: { id: '4', rol: 'CLIENTE', email: 'c@example.com', name: 'C' },
    });
    await expect(requireRole(['ADMIN', 'ASESOR'], '/admin')).rejects.toThrow('NOT_FOUND');
  });

  it('con el rol correcto devuelve el usuario con id numérico', async () => {
    authMock.mockResolvedValue({
      user: { id: '4', rol: 'ADMIN', email: 'a@example.com', name: 'A' },
    });
    await expect(requireRole(['ADMIN'])).resolves.toEqual({
      id: 4,
      rol: 'ADMIN',
      name: 'A',
      email: 'a@example.com',
    });
  });

  it('getCurrentUser ignora sesiones con id o rol inválidos', async () => {
    authMock.mockResolvedValue({ user: { id: 'abc', rol: 'ADMIN', email: 'a@example.com' } });
    expect(await getCurrentUser()).toBeNull();
    authMock.mockResolvedValue({ user: { id: '1', rol: 'ROOT', email: 'a@example.com' } });
    expect(await getCurrentUser()).toBeNull();
  });
});
