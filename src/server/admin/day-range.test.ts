import { describe, it, expect } from 'vitest';
import { parseDayRange, parseDayStart } from './day-range';

describe('parseDayStart (días de Bogotá)', () => {
  it('00:00 de Bogotá es 05:00 UTC', () => {
    expect(parseDayStart('2026-10-23')?.toISOString()).toBe('2026-10-23T05:00:00.000Z');
    expect(parseDayStart('2027-01-01')?.toISOString()).toBe('2027-01-01T05:00:00.000Z');
  });

  it.each([
    '',
    undefined,
    '2026-13-01',
    '2026-02-30',
    '2026-00-10',
    '26-10-23',
    '2026/10/23',
    '2026-10-23T00:00',
    'hoy',
    '2026-1-5',
  ])('rechaza %j', (value) => {
    expect(parseDayStart(value)).toBeNull();
  });

  it('acepta el 29 de febrero solo en año bisiesto', () => {
    expect(parseDayStart('2028-02-29')).not.toBeNull();
    expect(parseDayStart('2027-02-29')).toBeNull();
  });
});

describe('parseDayRange', () => {
  it('rango abierto sin valores', () => {
    expect(parseDayRange(undefined, undefined)).toEqual({ from: null, to: null, valid: true });
  });

  it('incluye ambos extremos: «hasta» es exclusivo del día siguiente', () => {
    const range = parseDayRange('2026-10-01', '2026-10-31');
    expect(range.valid).toBe(true);
    expect(range.from?.toISOString()).toBe('2026-10-01T05:00:00.000Z');
    expect(range.to?.toISOString()).toBe('2026-11-01T05:00:00.000Z');
  });

  it('una sola fecha de un día cubre ese día completo', () => {
    const range = parseDayRange('2026-10-23', '2026-10-23');
    expect(range.to!.getTime() - range.from!.getTime()).toBe(24 * 3_600_000);
  });

  it('fechas inválidas o desde > hasta → rango no válido (y abierto)', () => {
    expect(parseDayRange('2026-10-31', '2026-10-01')).toEqual({
      from: null,
      to: null,
      valid: false,
    });
    expect(parseDayRange('basura', undefined)).toEqual({ from: null, to: null, valid: false });
    expect(parseDayRange(undefined, '2026-02-30')).toEqual({ from: null, to: null, valid: false });
  });
});
