import { describe, expect, it } from 'vitest';
import { safeNextPath } from '@/lib/safe-redirect';
import { nextFromReferer } from './referer-next';

describe('nextFromReferer', () => {
  it('lee ?next= de la página de origen', () => {
    expect(nextFromReferer('https://sitio.test/login?next=%2Fmi-cuenta')).toBe('/mi-cuenta');
  });

  it('sin referer, sin next o con un referer inválido devuelve undefined', () => {
    expect(nextFromReferer(null)).toBeUndefined();
    expect(nextFromReferer('')).toBeUndefined();
    expect(nextFromReferer('https://sitio.test/login')).toBeUndefined();
    expect(nextFromReferer('esto no es una URL')).toBeUndefined();
  });

  it('combinado con safeNextPath neutraliza redirecciones abiertas', () => {
    for (const evil of [
      '//evil.test',
      'https://evil.test',
      '/\\evil.test',
      'javascript:alert(1)',
    ]) {
      const referer = `https://sitio.test/login?next=${encodeURIComponent(evil)}`;
      expect(safeNextPath(nextFromReferer(referer))).toBe('/');
    }
  });
});
