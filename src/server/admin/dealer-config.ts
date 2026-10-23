import 'server-only';

import { prisma } from '@/lib/db';
import { siteContent } from '@/lib/site-content';
import { isConfigKey, type ConfigKey } from '@/lib/validation/dealer-config';

export interface AdminConfigEntry {
  key: ConfigKey;
  /** Valor guardado en la BD (`null` si la clave aún no existe y se usa el valor de respaldo). */
  stored: string | null;
  /** Valor que usa el sitio ahora mismo (el guardado o el de respaldo). */
  effective: string;
}

function fallbackFor(key: ConfigKey): string {
  return key === 'whatsapp_numero'
    ? process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || siteContent.defaultFallbackSocials.whatsappNumber
    : siteContent.defaultFallbackSocials.instagramUrl;
}

/** Lectura directa (sin caché) de las claves editables, para mostrar el valor vigente en el panel. */
export async function listAdminConfig(keys: readonly ConfigKey[]): Promise<AdminConfigEntry[]> {
  const rows = await prisma.configuracionConcesionario.findMany({
    where: { clave: { in: [...keys] } },
    select: { clave: true, valor: true },
  });
  const stored = new Map(rows.map((r) => [r.clave, r.valor]));
  return keys.map((key) => ({
    key,
    stored: stored.get(key) ?? null,
    effective: stored.get(key) || fallbackFor(key),
  }));
}

export type SaveConfigResult =
  { status: 'ok'; previous: string | null } | { status: 'unknown_key' };

/**
 * Guarda el valor ya validado de una clave de la lista blanca (cualquier otra se rechaza aquí también) y
 * devuelve el valor anterior para la auditoría.
 */
export async function saveConfigValue(key: string, value: string): Promise<SaveConfigResult> {
  if (!isConfigKey(key)) return { status: 'unknown_key' };
  return prisma.$transaction(async (tx) => {
    const current = await tx.configuracionConcesionario.findUnique({
      where: { clave: key },
      select: { valor: true },
    });
    await tx.configuracionConcesionario.upsert({
      where: { clave: key },
      update: { valor: value },
      create: { clave: key, valor: value },
    });
    return { status: 'ok' as const, previous: current?.valor ?? null };
  });
}
