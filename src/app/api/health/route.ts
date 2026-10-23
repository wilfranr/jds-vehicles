import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { checkHealth, minFreeMbFromEnv } from '@/server/health';
import { getUploadsDir } from '@/server/media/storage';

/**
 * Salud para el monitoreo: BD, carpeta de subidas escribible y espacio libre. `200` si todo está sano y `503` si
 * algo falla, con un JSON mínimo (sin versiones, rutas ni mensajes internos) y sin caché.
 * Para el reinicio automático del proceso se usa `/api/health/live`, que no toca la BD.
 */
export async function GET() {
  const report = await checkHealth({
    pingDb: () => prisma.$queryRaw`SELECT 1`,
    uploadsDir: getUploadsDir(),
    minFreeMb: minFreeMbFromEnv(),
  });

  return NextResponse.json(report, {
    status: report.status === 'ok' ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
