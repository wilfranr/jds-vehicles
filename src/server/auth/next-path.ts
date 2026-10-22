/**
 * Devuelve `next` solo si es una ruta interna (empieza por una sola "/"); evita redirecciones
 * abiertas hacia otros dominios. En cualquier otro caso usa `fallback`.
 */
export function sanitizeNextPath(next: unknown, fallback = '/'): string {
  if (typeof next !== 'string') return fallback;
  if (!next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return fallback;
  if (/[\u0000-\u001f]/.test(next)) return fallback;
  return next;
}

export function buildLoginUrl(next: string): string {
  return `/login?next=${encodeURIComponent(sanitizeNextPath(next))}`;
}
