import { describe, it, expect } from 'vitest';
import { decideAccess } from './access';
import { config } from '@/proxy';

describe('decideAccess', () => {
  it('rutas públicas siempre permitidas', () => {
    for (const path of ['/', '/catalogo', '/vehiculos/1', '/login']) {
      expect(decideAccess(path, null)).toBe('allow');
    }
  });

  it('/mi-cuenta exige sesión', () => {
    expect(decideAccess('/mi-cuenta', null)).toBe('redirectLogin');
    expect(decideAccess('/mi-cuenta/perfil', null)).toBe('redirectLogin');
    expect(decideAccess('/mi-cuenta', 'CLIENTE')).toBe('allow');
  });

  it('/admin: anónimo → login, CLIENTE → 404, ADMIN y ASESOR → permitido', () => {
    expect(decideAccess('/admin', null)).toBe('redirectLogin');
    expect(decideAccess('/admin/vehiculos', 'CLIENTE')).toBe('notFound');
    expect(decideAccess('/admin', 'ADMIN')).toBe('allow');
    expect(decideAccess('/admin/vehiculos', 'ASESOR')).toBe('allow');
  });

  it('no confunde prefijos parecidos', () => {
    expect(decideAccess('/administrador', null)).toBe('allow');
    expect(decideAccess('/mi-cuentas', null)).toBe('allow');
  });

  it('no concede acceso por un rol obsoleto cuando se le pasa el rol fresco', () => {
    const staleRoleInJwt = 'ADMIN';
    const freshRoleFromDb = 'CLIENTE';
    expect(decideAccess('/admin', staleRoleInJwt)).toBe('allow');
    expect(decideAccess('/admin', freshRoleFromDb)).toBe('notFound');
  });
});

describe('matcher del proxy', () => {
  it('solo cubre rutas privadas (ni /_next, ni imágenes, ni /api/auth)', () => {
    const matchers = config.matcher as string[];
    expect(matchers).toEqual(['/mi-cuenta/:path*', '/admin/:path*']);
    for (const excluded of ['/_next/', '/_next/image', '/api/auth', '/logo.jpg', '/favicon.ico']) {
      expect(matchers.some((m) => excluded.startsWith(m.split('/:')[0] ?? '###'))).toBe(false);
    }
  });
});
