// Cabeceras de seguridad HTTP. Sin dependencias de Node ni alias `@/`: lo importa `next.config.ts`.

export interface CspOptions {
  /** `true` en `next dev`: React necesita `eval` para reconstruir pilas de errores. Nunca en producción. */
  development?: boolean;
  /** Orígenes remotos de imágenes (las fotos de demostración del seed). */
  imageHosts?: readonly string[];
  /** Ruta que recibe los informes de violaciones (opcional). */
  reportUri?: string;
}

const DEFAULT_IMAGE_HOSTS = ['https://images.unsplash.com'] as const;

/**
 * Política de contenido. Se aplica con una cabecera estática (no con nonce) para no volver dinámicas las
 * páginas públicas: un nonce exige renderizar cada petición y es incompatible con el prerenderizado parcial
 * (guía de CSP de Next 16). Consecuencia medida: Next emite scripts en línea (arranque de React y datos RSC) en
 * cada página, que ni un hash ni `'self'` pueden cubrir, así que `script-src` lleva `'unsafe-inline'`. Lo que
 * sigue bloqueado: scripts de otros orígenes, `eval`, `<style>` en línea, objetos, `<base>` ajeno, formularios hacia
 * otros sitios, conexiones a otros orígenes y el enmarcado. `style-src-attr` permite solo atributos `style`, que
 * `next/image` escribe en el HTML. `wa.me` es solo destino de enlaces (navegación), por eso no aparece.
 */
export function buildCsp(options: CspOptions = {}): string {
  const { development = false, imageHosts = DEFAULT_IMAGE_HOSTS, reportUri } = options;
  const directives: [string, string[]][] = [
    ['default-src', ["'self'"]],
    ['script-src', ["'self'", "'unsafe-inline'", ...(development ? ["'unsafe-eval'"] : [])]],
    ['style-src', ["'self'", ...(development ? ["'unsafe-inline'"] : [])]],
    ['style-src-attr', ["'unsafe-inline'"]],
    ['img-src', ["'self'", 'data:', 'blob:', ...imageHosts]],
    ['font-src', ["'self'"]],
    ['connect-src', ["'self'"]],
    ['media-src', ["'self'"]],
    ['object-src', ["'none'"]],
    ['base-uri', ["'self'"]],
    ['form-action', ["'self'"]],
    ['frame-ancestors', ["'none'"]],
    ...(development ? [] : ([['upgrade-insecure-requests', []]] as [string, string[]][])),
    ...(reportUri ? ([['report-uri', [reportUri]]] as [string, string[]][]) : []),
  ];
  return directives.map(([name, values]) => [name, ...values].join(' ')).join('; ');
}

export interface HeaderPair {
  key: string;
  value: string;
}

/** Cabeceras que se envían en todas las rutas. HSTS no va aquí: depende de que la petición llegara por HTTPS. */
export function buildSecurityHeaders(options: CspOptions = {}): HeaderPair[] {
  return [
    {
      // En desarrollo solo informa, para ajustar la política sin romper la página.
      key: options.development ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy',
      value: buildCsp(options),
    },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
    { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  ];
}

export const HSTS_VALUE = 'max-age=31536000; includeSubDomains';

export interface HeaderRule {
  source: string;
  has?: { type: 'header'; key: string; value: string }[];
  headers: HeaderPair[];
}

/**
 * Reglas para `headers()` de `next.config.ts`. HSTS solo en producción y si el proxy indica que el cliente llegó
 * por HTTPS (`X-Forwarded-Proto: https`); por HTTP sería inútil y en `localhost` molesto. Se resuelve con la
 * condición `has` de Next, sin pasar por el proxy, para no tocar el prerenderizado.
 */
export function buildHeaderRules(
  options: CspOptions & { production?: boolean } = {}
): HeaderRule[] {
  const { production = !options.development, ...csp } = options;
  const rules: HeaderRule[] = [{ source: '/:path*', headers: buildSecurityHeaders(csp) }];
  if (production) {
    rules.push({
      source: '/:path*',
      has: [{ type: 'header', key: 'x-forwarded-proto', value: 'https' }],
      headers: [{ key: 'Strict-Transport-Security', value: HSTS_VALUE }],
    });
  }
  return rules;
}
