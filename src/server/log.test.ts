import { afterEach, describe, expect, it, vi } from 'vitest';
import { logAdminEvent } from '@/server/admin/audit';
import { logReservationEvent } from '@/server/reservations/events';
import { logSecurityEvent, maskEmail } from '@/server/security/audit';
import { formatLogLine, isLevelEnabled, logEvent } from './log';

afterEach(() => vi.restoreAllMocks());

const NOW = () => new Date('2026-10-24T10:00:00.000Z');

describe('formatLogLine', () => {
  it('una línea JSON con ts, level y channel (info por defecto)', () => {
    const line = formatLogLine({ channel: 'app', event: 'arranque', port: 3000 }, {}, NOW);
    expect(line).not.toContain('\n');
    expect(JSON.parse(line!)).toEqual({
      ts: '2026-10-24T10:00:00.000Z',
      level: 'info',
      channel: 'app',
      event: 'arranque',
      port: 3000,
    });
  });

  it('LOG_LEVEL filtra por nivel', () => {
    const event = { channel: 'app' as const };
    expect(formatLogLine({ ...event, level: 'debug' }, {}, NOW)).toBeNull();
    expect(formatLogLine({ ...event, level: 'debug' }, { LOG_LEVEL: 'debug' }, NOW)).not.toBeNull();
    expect(formatLogLine({ ...event, level: 'info' }, { LOG_LEVEL: 'warn' }, NOW)).toBeNull();
    expect(formatLogLine({ ...event, level: 'warn' }, { LOG_LEVEL: 'warn' }, NOW)).not.toBeNull();
    expect(formatLogLine({ ...event, level: 'error' }, { LOG_LEVEL: 'error' }, NOW)).not.toBeNull();
    expect(formatLogLine({ ...event, level: 'warn' }, { LOG_LEVEL: 'error' }, NOW)).toBeNull();
    // un valor inválido cae al nivel por defecto
    expect(formatLogLine({ ...event, level: 'info' }, { LOG_LEVEL: 'ruido' }, NOW)).not.toBeNull();
  });

  it('isLevelEnabled ordena debug < info < warn < error', () => {
    expect(isLevelEnabled('error', 'debug')).toBe(true);
    expect(isLevelEnabled('debug', 'error')).toBe(false);
    expect(isLevelEnabled('warn', 'warn')).toBe(true);
  });

  it('redacta los campos con nombre de secreto, a cualquier profundidad', () => {
    const line = formatLogLine(
      {
        channel: 'app',
        password: 'Clave-Secreta-1',
        passwordHash: '$2b$12$abcdef',
        authToken: 'tok-123',
        cookie: 'session=abc',
        Authorization: 'Bearer xyz',
        nested: { apiKey: 'k-999', ok: 'visible' },
        list: [{ secret: 's-1' }],
      },
      {},
      NOW
    )!;
    for (const leaked of [
      'Clave-Secreta-1',
      '$2b$12$',
      'tok-123',
      'session=abc',
      'Bearer xyz',
      'k-999',
      's-1',
    ]) {
      expect(line).not.toContain(leaked);
    }
    const parsed = JSON.parse(line);
    expect(parsed.password).toBe('[redacted]');
    expect(parsed.nested).toEqual({ apiKey: '[redacted]', ok: 'visible' });
  });

  it('recorta textos largos y limita la profundidad', () => {
    const parsed = JSON.parse(
      formatLogLine({ channel: 'app', text: 'x'.repeat(5000), a: { b: { c: { d: 1 } } } }, {}, NOW)!
    );
    expect(parsed.text.length).toBeLessThan(400);
    expect(parsed.a.b.c).toBe('[omitted]');
  });
});

describe('logEvent', () => {
  it('escribe la línea en stdout (console.info)', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    logEvent({ channel: 'ops', event: 'x' });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(spy.mock.calls[0]![0]))).toMatchObject({
      channel: 'ops',
      level: 'info',
    });
  });
});

describe('los eventos conocidos no filtran datos personales ni secretos', () => {
  function capture(run: () => void): string {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    run();
    return spy.mock.calls.map((c) => String(c[0])).join('\n');
  }

  it('seguridad: el correo va enmascarado y nunca hay contraseñas', () => {
    const out = capture(() => {
      logSecurityEvent({
        type: 'login_failed',
        ip: '203.0.113.9',
        detail: maskEmail('ana.perez@example.com'),
      });
      logSecurityEvent({ type: 'password_changed', userId: 5, ip: '203.0.113.9' });
    });
    expect(out).toContain('"channel":"security"');
    expect(out).toContain('"level":"warn"');
    expect(out).not.toContain('ana.perez@example.com');
    expect(out).not.toMatch(/password"|contraseña/i);
  });

  it('panel: solo ids y acciones', () => {
    const out = capture(() => {
      logAdminEvent({ actorId: 1, action: 'user_password_reset', entity: 'user', entityId: 9 });
      logAdminEvent({
        actorId: 1,
        action: 'sale.registered',
        entity: 'sale',
        entityId: 3,
        detail: 'VTA-2026-000001; precio 1000.00',
      });
    });
    expect(out).toContain('"channel":"admin"');
    expect(out).not.toMatch(/@|\$2[aby]\$/);
  });

  it('reservas: solo ids y motivo', () => {
    const out = capture(() => {
      logReservationEvent({
        type: 'reservation_created',
        userId: 4,
        vehicleId: 7,
        reservationId: 12,
      });
      logReservationEvent({
        type: 'reservation_rejected',
        userId: 4,
        vehicleId: 7,
        reason: 'limit_reached',
      });
      logReservationEvent({ type: 'reservations_expired', expired: 2, vehiclesReleased: 1 });
    });
    expect(out).toContain('"channel":"reservations"');
    expect(out).not.toMatch(/@|telefono|nombre|documento/i);
  });
});
