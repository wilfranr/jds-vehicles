import type { MetadataRoute } from 'next';
import { getLegalLinks } from '@/lib/legal';
import { getSiteUrl } from '@/lib/site-url';
import { getSitemapVehicles } from '@/server/catalog/queries';

const STATIC_ROUTES = ['/', '/catalogo', '/proximamente', '/como-funciona', '/contacto'];

// Las páginas legales solo entran en el sitemap cuando existen (`getLegalLinks()` está vacío sin contenido).
const legalRoutes = () => getLegalLinks().map((link) => link.href);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getSiteUrl();
  const vehicles = await getSitemapVehicles();

  return [
    ...[...STATIC_ROUTES, ...legalRoutes()].map((route) => ({
      url: route === '/' ? baseUrl : `${baseUrl}${route}`,
      changeFrequency:
        route === '/catalogo' || route === '/' ? ('daily' as const) : ('monthly' as const),
      priority: route === '/' ? 1 : 0.7,
    })),
    ...vehicles.map((vehicle) => ({
      url: `${baseUrl}/vehiculos/${vehicle.id}`,
      lastModified: vehicle.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ];
}
