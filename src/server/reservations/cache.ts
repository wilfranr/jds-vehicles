import { revalidateTag, updateTag } from 'next/cache';

/** Etiquetas del catálogo que dependen de la disponibilidad de un vehículo. */
export const CATALOG_CACHE_TAGS = ['catalog-vehicles', 'catalog-filter-options'] as const;

/**
 * Para Server Actions (F3-02): `updateTag` expira la caché al instante, así quien reserva ve el vehículo como
 * «Reservado» de inmediato (lectura de lo escrito). Next 16 solo permite `updateTag` dentro de Server Actions.
 */
export function invalidateCatalogFromAction(): void {
  for (const tag of CATALOG_CACHE_TAGS) updateTag(tag);
}

/**
 * Para contextos que no son Server Actions (tarea de expiración de F3-04, Route Handlers): `revalidateTag` con
 * el perfil `max` (stale-while-revalidate). La firma de un solo argumento está deprecada en Next 16.
 */
export function invalidateCatalogInBackground(): void {
  for (const tag of CATALOG_CACHE_TAGS) revalidateTag(tag, 'max');
}
