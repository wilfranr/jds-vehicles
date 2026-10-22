import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getDealerConfig } from './config';
import { prisma } from '@/lib/db';
import { siteContent } from '@/lib/site-content';

describe('getDealerConfig', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('devuelve la configuración de la base de datos cuando está disponible', async () => {
    vi.spyOn(prisma.configuracionConcesionario, 'findMany').mockResolvedValueOnce([
      {
        id: 1,
        clave: 'whatsapp_numero',
        valor: '573999999999',
        descripcion: null,
        updatedAt: new Date(),
      },
      {
        id: 2,
        clave: 'instagram_url',
        valor: 'https://instagram.com/jds_test',
        descripcion: null,
        updatedAt: new Date(),
      },
    ]);

    const config = await getDealerConfig();
    expect(config.whatsappNumber).toBe('573999999999');
    expect(config.instagramUrl).toBe('https://instagram.com/jds_test');
  });

  it('devuelve los valores de respaldo de forma transitoria ante un fallo de conexión en la BD sin lanzar error', async () => {
    vi.spyOn(prisma.configuracionConcesionario, 'findMany').mockRejectedValueOnce(
      new Error('Connection lost to database')
    );

    const config = await getDealerConfig();
    expect(config.whatsappNumber).toBe(siteContent.defaultFallbackSocials.whatsappNumber);
    expect(config.instagramUrl).toBe(siteContent.defaultFallbackSocials.instagramUrl);
  });
});
