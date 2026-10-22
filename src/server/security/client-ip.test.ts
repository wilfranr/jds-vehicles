import { describe, it, expect } from 'vitest';
import { getClientIp, UNKNOWN_IP } from './client-ip';

const h = (value: string | null) => ({
  get: (name: string) => (name === 'x-forwarded-for' ? value : null),
});

describe('getClientIp', () => {
  it('ignora x-forwarded-for si TRUST_PROXY no está activo', () => {
    expect(getClientIp(h('1.2.3.4'), {})).toBe(UNKNOWN_IP);
    expect(getClientIp(h('1.2.3.4'), { TRUST_PROXY: 'false' })).toBe(UNKNOWN_IP);
  });

  it('con un proxy confiable toma el último valor (el que añadió el proxy), no el primero', () => {
    expect(getClientIp(h('6.6.6.6, 198.51.100.7'), { TRUST_PROXY: 'true' })).toBe('198.51.100.7');
  });

  it('respeta TRUST_PROXY_HOPS', () => {
    const env = { TRUST_PROXY: 'true', TRUST_PROXY_HOPS: '2' };
    expect(getClientIp(h('6.6.6.6, 198.51.100.7, 10.0.0.1'), env)).toBe('198.51.100.7');
    expect(getClientIp(h('198.51.100.7'), env)).toBe('198.51.100.7');
  });

  it('usa un valor fijo ante cabecera ausente, vacía o inválida', () => {
    const env = { TRUST_PROXY: 'true' };
    expect(getClientIp(h(null), env)).toBe(UNKNOWN_IP);
    expect(getClientIp(h(''), env)).toBe(UNKNOWN_IP);
    expect(getClientIp(h('<script>'), env)).toBe(UNKNOWN_IP);
    expect(getClientIp(h('x'.repeat(500)), env)).toBe(UNKNOWN_IP);
  });

  it('acepta IPv6 y ignora un TRUST_PROXY_HOPS inválido', () => {
    expect(getClientIp(h('2001:db8::1'), { TRUST_PROXY: 'true', TRUST_PROXY_HOPS: 'abc' })).toBe(
      '2001:db8::1'
    );
  });
});
