import { describe, expect, it } from 'vitest';
import { buildCsp, buildHeaderRules, buildSecurityHeaders, HSTS_VALUE } from './headers';

const directives = (csp: string) =>
  Object.fromEntries(
    csp.split('; ').map((d) => {
      const [name, ...values] = d.split(' ');
      return [name!, values];
    })
  );

describe('buildCsp (producción)', () => {
  const csp = buildCsp();
  const parsed = directives(csp);

  it('no tiene directivas duplicadas', () => {
    const names = csp.split('; ').map((d) => d.split(' ')[0]);
    expect(new Set(names).size).toBe(names.length);
  });

  it('nunca permite eval', () => {
    expect(csp).not.toContain("'unsafe-eval'");
  });

  it("'unsafe-inline' solo en script-src (scripts de Next) y style-src-attr (next/image), no en <style>", () => {
    const withInline = Object.entries(parsed)
      .filter(([, v]) => v.includes("'unsafe-inline'"))
      .map(([k]) => k)
      .sort();
    expect(withInline).toEqual(['script-src', 'style-src-attr']);
    expect(parsed['style-src']).toEqual(["'self'"]);
  });

  it('cierra objetos, base, formularios y enmarcado', () => {
    expect(parsed['default-src']).toEqual(["'self'"]);
    expect(parsed['object-src']).toEqual(["'none'"]);
    expect(parsed['base-uri']).toEqual(["'self'"]);
    expect(parsed['form-action']).toEqual(["'self'"]);
    expect(parsed['frame-ancestors']).toEqual(["'none'"]);
    expect(parsed['connect-src']).toEqual(["'self'"]);
  });

  it('solo permite scripts propios y las fotos del seed como origen remoto de imágenes', () => {
    expect(parsed['script-src']!.filter((v) => !v.startsWith("'"))).toEqual([]);
    expect(parsed['img-src']).toEqual(["'self'", 'data:', 'blob:', 'https://images.unsplash.com']);
  });

  it('wa.me no es origen de ningún recurso', () => {
    expect(csp).not.toContain('wa.me');
  });

  it('actualiza peticiones inseguras y admite report-uri opcional', () => {
    expect(parsed['upgrade-insecure-requests']).toEqual([]);
    expect(buildCsp({ reportUri: '/api/csp-report' })).toContain('report-uri /api/csp-report');
    expect(csp).not.toContain('report-uri');
  });
});

describe('buildCsp (desarrollo)', () => {
  it('añade eval y estilos en línea solo ahí, y no fuerza HTTPS', () => {
    const csp = buildCsp({ development: true });
    expect(csp).toContain("'unsafe-eval'");
    expect(directives(csp)['style-src']).toContain("'unsafe-inline'");
    expect(csp).not.toContain('upgrade-insecure-requests');
  });
});

describe('buildSecurityHeaders', () => {
  const get = (headers: { key: string; value: string }[], key: string) =>
    headers.find((h) => h.key === key)?.value;

  it('en producción aplica la política y envía el resto de cabeceras', () => {
    const headers = buildSecurityHeaders();
    expect(get(headers, 'Content-Security-Policy')).toBe(buildCsp());
    expect(get(headers, 'Content-Security-Policy-Report-Only')).toBeUndefined();
    expect(get(headers, 'Cross-Origin-Opener-Policy')).toBe('same-origin');
    expect(get(headers, 'Cross-Origin-Resource-Policy')).toBe('same-origin');
    expect(get(headers, 'X-Content-Type-Options')).toBe('nosniff');
    expect(get(headers, 'X-Frame-Options')).toBe('DENY');
    expect(get(headers, 'Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(get(headers, 'Strict-Transport-Security')).toBeUndefined();
  });

  it('en desarrollo solo informa (Report-Only)', () => {
    const headers = buildSecurityHeaders({ development: true });
    expect(get(headers, 'Content-Security-Policy')).toBeUndefined();
    expect(get(headers, 'Content-Security-Policy-Report-Only')).toBe(
      buildCsp({ development: true })
    );
  });

  it('no repite cabeceras', () => {
    const keys = buildSecurityHeaders().map((h) => h.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('buildHeaderRules', () => {
  it('en producción añade HSTS solo si el proxy indica HTTPS', () => {
    const rules = buildHeaderRules({ development: false });
    expect(rules).toHaveLength(2);
    expect(rules[0]!.headers.map((h) => h.key)).not.toContain('Strict-Transport-Security');
    expect(rules[1]).toEqual({
      source: '/:path*',
      has: [{ type: 'header', key: 'x-forwarded-proto', value: 'https' }],
      headers: [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }],
    });
    expect(HSTS_VALUE).toContain('max-age=31536000');
  });

  it('en desarrollo no hay HSTS', () => {
    const rules = buildHeaderRules({ development: true });
    expect(rules).toHaveLength(1);
    expect(JSON.stringify(rules)).not.toContain('Strict-Transport-Security');
  });
});
