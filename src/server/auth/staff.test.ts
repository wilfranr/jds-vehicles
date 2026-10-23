import { describe, it, expect, vi, beforeEach } from 'vitest';

const authMock = vi.fn();
const findUnique = vi.fn();
vi.mock('@/auth', () => ({ auth: () => authMock() }));
vi.mock('@/lib/db', () => ({ prisma: { user: { findUnique: (a: unknown) => findUnique(a) } } }));
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
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

import { requireAdmin, requireStaff } from './staff';

function session(rol: string, id = '4') {
  authMock.mockResolvedValue({ user: { id, rol, email: 'u@example.com', name: 'U' } });
}

function dbUser(rol: string, activo = true) {
  findUnique.mockResolvedValue({
    id: 4,
    nombre: 'Uno',
    apellido: 'Prueba',
    email: 'u@example.com',
    activo,
    rol: { nombre: rol },
  });
}

beforeEach(() => {
  authMock.mockReset();
  findUnique.mockReset();
});

describe('requireStaff', () => {
  it('sin sesión redirige a login con la ruta de retorno', async () => {
    authMock.mockResolvedValue(null);
    await expect(requireStaff('/admin/reservas')).rejects.toThrow(
      'REDIRECT:/login?next=%2Fadmin%2Freservas'
    );
  });

  it('un CLIENTE recibe 404 sin consultar la BD', async () => {
    session('CLIENTE');
    await expect(requireStaff()).rejects.toThrow('NOT_FOUND');
    expect(findUnique).not.toHaveBeenCalled();
  });

  it.each(['ADMIN', 'ASESOR'])('%s entra y se devuelve el usuario de la BD', async (rol) => {
    session(rol);
    dbUser(rol);
    await expect(requireStaff()).resolves.toMatchObject({ id: 4, rol, name: 'Uno Prueba' });
  });

  it('un token ADMIN de alguien desactivado en la BD recibe 404', async () => {
    session('ADMIN');
    dbUser('ADMIN', false);
    await expect(requireStaff()).rejects.toThrow('NOT_FOUND');
  });

  it('el rol vigente de la BD manda sobre el del token (degradado a CLIENTE)', async () => {
    session('ADMIN');
    dbUser('CLIENTE');
    await expect(requireStaff()).rejects.toThrow('NOT_FOUND');
  });

  it('usuario eliminado de la BD con token vigente recibe 404', async () => {
    session('ASESOR');
    findUnique.mockResolvedValue(null);
    await expect(requireStaff()).rejects.toThrow('NOT_FOUND');
  });
});

describe('requireAdmin', () => {
  it('un ASESOR recibe 404 (usuarios y configuración son solo de ADMIN)', async () => {
    session('ASESOR');
    dbUser('ASESOR');
    await expect(requireAdmin()).rejects.toThrow('NOT_FOUND');
  });

  it('un ASESOR ascendido solo en el token no pasa si la BD dice ASESOR', async () => {
    session('ADMIN');
    dbUser('ASESOR');
    await expect(requireAdmin()).rejects.toThrow('NOT_FOUND');
  });

  it('un ADMIN confirmado en la BD entra', async () => {
    session('ADMIN');
    dbUser('ADMIN');
    await expect(requireAdmin()).resolves.toMatchObject({ rol: 'ADMIN' });
  });
});
