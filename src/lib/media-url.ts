/**
 * Utilidades de URL de fotos sin dependencias de servidor (las usan los componentes de la web pública).
 * Las fotos subidas desde el panel son `/media/<uuid>.webp` con miniatura `/media/<uuid>_t.webp`; las del seed
 * son URLs externas.
 */
const LOCAL_MEDIA =
  /^\/media\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}(_t)?\.webp$/;

export function isLocalMedia(url: string): boolean {
  return LOCAL_MEDIA.test(url);
}

/** Miniatura de una foto subida (480 px); las externas se devuelven tal cual. */
export function thumbOf(url: string): string {
  return isLocalMedia(url) && !url.endsWith('_t.webp') ? url.replace(/\.webp$/, '_t.webp') : url;
}
