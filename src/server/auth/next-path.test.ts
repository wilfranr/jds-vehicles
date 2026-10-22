import { describe, it, expect } from 'vitest';
import { buildLoginUrl } from './next-path';

describe('buildLoginUrl', () => {
  it('codifica la ruta de retorno', () => {
    expect(buildLoginUrl('/mi-cuenta?x=1')).toBe('/login?next=%2Fmi-cuenta%3Fx%3D1');
  });
  it('descarta rutas externas', () => {
    expect(buildLoginUrl('//evil.com')).toBe('/login?next=%2F');
  });
});
