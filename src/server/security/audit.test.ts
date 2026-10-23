import { describe, it, expect, vi, afterEach } from 'vitest';
import { logSecurityEvent, maskEmail } from './audit';

afterEach(() => vi.restoreAllMocks());

describe('maskEmail', () => {
  it('enmascara el usuario conservando el dominio', () => {
    expect(maskEmail('ana.perez@dominio.com')).toBe('a***@dominio.com');
  });
  it('no revela entradas sin formato de correo', () => {
    expect(maskEmail('sin-arroba')).toBe('***');
    expect(maskEmail('@dominio.com')).toBe('***');
  });
});

describe('logSecurityEvent', () => {
  it('escribe una sola línea JSON con los campos esperados', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    logSecurityEvent({ type: 'login_failed', ip: '203.0.113.1', detail: maskEmail('ana@x.com') });
    expect(spy).toHaveBeenCalledTimes(1);
    const line = String(spy.mock.calls[0]?.[0]);
    expect(line).not.toContain('\n');
    expect(JSON.parse(line)).toMatchObject({
      channel: 'security',
      type: 'login_failed',
      ip: '203.0.113.1',
      detail: 'a***@x.com',
    });
    expect(line).not.toContain('ana@x.com');
  });

  it('recorta detalles largos', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    logSecurityEvent({ type: 'forbidden_access', ip: 'unknown', detail: 'x'.repeat(5000) });
    expect(String(spy.mock.calls[0]?.[0]).length).toBeLessThan(500);
  });
});
