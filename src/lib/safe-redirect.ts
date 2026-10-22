/**
 * Devuelve `next` solo si es una ruta relativa interna (empieza por una sola "/", sin esquema,
 * host, barra invertida ni caracteres de control); cualquier otra cosa → "/".
 */
export function safeNextPath(next: string | string[] | null | undefined): string {
  if (typeof next !== 'string') return '/';
  if (!next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return '/';
  if (next.includes('\\') || /[\u0000-\u001f\u007f]/.test(next)) return '/';
  return next;
}
