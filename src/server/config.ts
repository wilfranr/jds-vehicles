import { prisma } from '@/lib/db';
import { siteContent } from '@/lib/site-content';
import { cacheTag } from 'next/cache';

export interface DealerConfig {
  whatsappNumber: string;
  instagramUrl: string;
}

/**
 * Obtiene la configuración pública de contacto y redes del concesionario.
 * Utiliza caché a través de Cache Components ('use cache' y cacheTag)
 * y recurre a la variable de entorno NEXT_PUBLIC_WHATSAPP_NUMBER o al valor
 * por defecto de siteContent si la base de datos no está disponible.
 */
export async function getDealerConfig(): Promise<DealerConfig> {
  'use cache';
  cacheTag('dealer-config');

  const fallbackNumber =
    process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || siteContent.defaultFallbackSocials.whatsappNumber;
  const fallbackInstagram = siteContent.defaultFallbackSocials.instagramUrl;

  try {
    const configs = await prisma.configuracionConcesionario.findMany({
      where: {
        clave: {
          in: ['whatsapp_numero', 'instagram_url'],
        },
      },
    });

    const configMap = new Map(configs.map((c) => [c.clave, c.valor]));

    return {
      whatsappNumber: configMap.get('whatsapp_numero') || fallbackNumber,
      instagramUrl: configMap.get('instagram_url') || fallbackInstagram,
    };
  } catch (error) {
    console.warn(
      '⚠️ No se pudo conectar a la base de datos para cargar configuracionConcesionario. Usando valores de respaldo.',
      error
    );
    return {
      whatsappNumber: fallbackNumber,
      instagramUrl: fallbackInstagram,
    };
  }
}
