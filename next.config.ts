import type { NextConfig } from 'next';
import { buildHeaderRules } from './src/server/security/headers';

const development = process.env.NODE_ENV !== 'production';

const nextConfig: NextConfig = {
  // Solo en la imagen de producción (Dockerfile): salida mínima con las dependencias trazadas. Con `next start`
  // (desarrollo, CI, e2e) no se activa.
  ...(process.env.NEXT_OUTPUT === 'standalone' ? { output: 'standalone' as const } : {}),
  async headers() {
    return buildHeaderRules({ development });
  },
  // Las pruebas no deben viajar en la imagen (el trazado incluye carpetas enteras de `src/server`).
  outputFileTracingExcludes: { '*': ['src/**/*.test.*', 'src/**/*.spec.*'] },
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
