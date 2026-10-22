import { describe, it, expect } from 'vitest';
import { sanitizeNextPath, buildLoginUrl } from './next-path';

describe('sanitizeNextPath', () => {
  it('acepta rutas internas con query', () => {
    expect(sanitizeNextPath('/mi-cuenta?tab=1')).toBe('/mi-cuenta?tab=1');
  });
  it.each([
    '//evil.com',
    'https://evil.com',
    '/\\evil.com',
    'mi-cuenta',
    '',
    undefined,
    42,
    '/a\nb',
  ])('rechaza %j', (value) => {
    expect(sanitizeNextPath(value)).toBe('/');
  });
  it('construye la URL de login codificada', () => {
    expect(buildLoginUrl('/mi-cuenta?x=1')).toBe('/login?next=%2Fmi-cuenta%3Fx%3D1');
  });
});
