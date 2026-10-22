/**
 * Lee `?next=` de la página desde la que se envió un formulario (cabecera `Referer`). Los formularios de
 * `/login` y `/registro` son estáticos (funcionan sin JavaScript y sin `searchParams` en el servidor);
 * el valor debe validarse siempre con `safeNextPath`.
 */
export function nextFromReferer(referer: string | null): string | undefined {
  if (!referer) return undefined;
  try {
    return new URL(referer).searchParams.get('next') ?? undefined;
  } catch {
    return undefined;
  }
}
