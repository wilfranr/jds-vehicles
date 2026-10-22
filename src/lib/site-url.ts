const DEFAULT_SITE_URL = 'http://localhost:3000';

/** Origen público del sitio (sin barra final), desde `NEXT_PUBLIC_SITE_URL`. */
export function getSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, '');
}
