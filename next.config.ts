import type { NextConfig } from 'next';
import { buildHeaderRules } from './src/server/security/headers';

const development = process.env.NODE_ENV !== 'production';

const nextConfig: NextConfig = {
  async headers() {
    return buildHeaderRules({ development });
  },
  poweredByHeader: false,
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    // Dominio utilizado en los seeds de demostración para fotografías vehiculares.
    // El dominio final para producción se definirá con el almacenamiento de la Fase 4.
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;
