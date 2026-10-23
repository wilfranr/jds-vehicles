import { describe, it, expect } from 'vitest';
import {
  assertReservationEnv,
  DEFAULT_RESERVATION_EXPIRY_HOURS,
  expirationDate,
  MAX_ACTIVE_RESERVATIONS_PER_USER,
  parseReservationExpirationHours,
} from './config';

describe('RESERVA_EXPIRACION_HORAS', () => {
  it('sin la variable usa el valor por defecto de 48 horas', () => {
    expect(DEFAULT_RESERVATION_EXPIRY_HOURS).toBe(48);
    expect(parseReservationExpirationHours({})).toBe(48);
    expect(parseReservationExpirationHours({ RESERVA_EXPIRACION_HORAS: '  ' })).toBe(48);
  });

  it('el valor 0 desactiva la expiración', () => {
    expect(parseReservationExpirationHours({ RESERVA_EXPIRACION_HORAS: '0' })).toBeNull();
  });

  it('acepta enteros positivos', () => {
    expect(parseReservationExpirationHours({ RESERVA_EXPIRACION_HORAS: '24' })).toBe(24);
    expect(parseReservationExpirationHours({ RESERVA_EXPIRACION_HORAS: ' 48 ' })).toBe(48);
  });

  it.each(['-5', '1.5', '1e3', 'abc', '24h', '0024', '9999999'])(
    'rechaza %s con un mensaje claro',
    (value) => {
      expect(() => parseReservationExpirationHours({ RESERVA_EXPIRACION_HORAS: value })).toThrow(
        /RESERVA_EXPIRACION_HORAS/
      );
      expect(() => assertReservationEnv({ RESERVA_EXPIRACION_HORAS: value })).toThrow();
    }
  );

  it('no valida durante el build', () => {
    expect(() =>
      assertReservationEnv({
        NEXT_PHASE: 'phase-production-build',
        RESERVA_EXPIRACION_HORAS: 'abc',
      })
    ).not.toThrow();
  });

  it('calcula la fecha de expiración a N horas, o null', () => {
    const now = new Date('2026-10-23T10:00:00.000Z');
    expect(expirationDate(now, 24)?.toISOString()).toBe('2026-10-24T10:00:00.000Z');
    expect(expirationDate(now, null)).toBeNull();
  });
});

describe('tope de reservas activas', () => {
  it('está definido en un único lugar con el valor provisional', () => {
    expect(MAX_ACTIVE_RESERVATIONS_PER_USER).toBe(2);
  });
});
