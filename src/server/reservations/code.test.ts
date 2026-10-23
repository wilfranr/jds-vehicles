import { describe, it, expect } from 'vitest';
import { CODE_ALPHABET, CODE_PATTERN, generateReservationCode } from './code';

describe('generateReservationCode', () => {
  it('tiene el formato RES-AAAA-XXXX con el año de la reserva', () => {
    const code = generateReservationCode(new Date('2027-03-04T10:00:00'));
    expect(code).toMatch(CODE_PATTERN);
    expect(code.startsWith('RES-2027-')).toBe(true);
  });

  it('usa solo el alfabeto sin ambigüedades (sin 0, O, 1, I)', () => {
    expect(CODE_ALPHABET).toHaveLength(32);
    for (const ambiguous of ['0', 'O', '1', 'I']) expect(CODE_ALPHABET).not.toContain(ambiguous);
    for (let i = 0; i < 500; i++) expect(generateReservationCode()).toMatch(CODE_PATTERN);
  });

  it('cubre todo el alfabeto con el generador criptográfico por defecto', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 2000; i++) for (const c of generateReservationCode().slice(-4)) seen.add(c);
    expect(seen.size).toBe(32);
  });

  it('usa el generador inyectado (determinista para pruebas)', () => {
    expect(generateReservationCode(new Date('2026-01-01T00:00:00'), () => 0)).toBe('RES-2026-AAAA');
    expect(generateReservationCode(new Date('2026-01-01T00:00:00'), () => 31)).toBe(
      'RES-2026-9999'
    );
  });
});
