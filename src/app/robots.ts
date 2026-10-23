import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/site-url';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getSiteUrl();

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // El panel y la cuenta llevan además `noindex`; aquí se excluyen del rastreo (defensa en profundidad).
      disallow: ['/api', '/_design', '/admin', '/mi-cuenta'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
