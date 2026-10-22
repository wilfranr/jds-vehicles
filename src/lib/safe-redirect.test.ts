import { describe, it, expect } from 'vitest';
import { safeNextPath } from './safe-redirect';

describe('safeNextPath', () => {
  it.each([
    ['/vehiculos/2?x=1', '/vehiculos/2?x=1'],
    ['/mi-cuenta', '/mi-cuenta'],
    ['/', '/'],
  ])('acepta la ruta interna %j', (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });

  it.each([
    '//evil.com',
    '/\\evil.com',
    'https://evil.com',
    'javascript:alert(1)',
    'mi-cuenta',
    '',
    '/a\nb',
    '/a\u0000b',
    '/ok\\..\\evil',
  ])('rechaza %j', (input) => {
    expect(safeNextPath(input)).toBe('/');
  });

  it('rechaza valores que no son cadena', () => {
    expect(safeNextPath(undefined)).toBe('/');
    expect(safeNextPath(null)).toBe('/');
    expect(safeNextPath(['/a', '/b'])).toBe('/');
  });
});
