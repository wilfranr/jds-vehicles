import { prisma } from '@/lib/db';
import { siteContent } from '@/lib/site-content';
import { cacheTag } from 'next/cache';
import { logEvent } from '@/server/log';

export interface DealerConfig {
  whatsappNumber: string;
  instagramUrl: string;
}

/**
 * Consulta la base de datos para obtener las claves de configuración del concesionario.
 * Utiliza Cache Components ('use cache' y cacheTag) para que solo las lecturas exitosas
 * queden en caché. Si la base de datos falla, la excepción se lanza sin atrapar, evitando
 * que Next.js persista datos de error en la caché.
 */
async function fetchDealerConfigFromDb(): Promise<{
  whatsappNumber: string | undefined;
  instagramUrl: string | undefined;
}> {
  'use cache';
  cacheTag('dealer-config');

  const configs = await prisma.configuracionConcesionario.findMany({
    where: {
      clave: {
        in: ['whatsapp_numero', 'instagram_url'],
      },
    },
  });

  const configMap = new Map(configs.map((c) => [c.clave, c.valor]));

  return {
    whatsappNumber: configMap.get('whatsapp_numero'),
    instagramUrl: configMap.get('instagram_url'),
  };
}

/**
 * Obtiene la configuración pública de contacto y redes del concesionario.
 * Llama a la función cacheada `fetchDealerConfigFromDb()`.
 * Si la base de datos está caída o falla, captura el error y devuelve los valores
 * de respaldo de forma transitoria SIN cachear el estado de error.
 */
export async function getDealerConfig(): Promise<DealerConfig> {
  const fallbackNumber =
    process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || siteContent.defaultFallbackSocials.whatsappNumber;
  const fallbackInstagram = siteContent.defaultFallbackSocials.instagramUrl;

  try {
    const dbConfig = await fetchDealerConfigFromDb();

    return {
      whatsappNumber: dbConfig.whatsappNumber || fallbackNumber,
      instagramUrl: dbConfig.instagramUrl || fallbackInstagram,
    };
  } catch (error) {
    // Solo el nombre del error: el mensaje puede incluir datos de conexión.
    logEvent({
      channel: 'app',
      level: 'warn',
      event: 'dealer_config_fallback',
      errorName: error instanceof Error ? error.name : 'Error',
    });
    return {
      whatsappNumber: fallbackNumber,
      instagramUrl: fallbackInstagram,
    };
  }
}
