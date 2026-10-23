import { z } from 'zod';
import './zod-setup';
import { normalizeColombianMobile } from './register';

/**
 * Claves de `configuracion_concesionario` que el panel puede editar (lista blanca en código): no se pueden
 * crear ni modificar claves arbitrarias. Son las que lee `getDealerConfig()`.
 */
export const CONFIG_KEYS = ['whatsapp_numero', 'instagram_url'] as const;
export type ConfigKey = (typeof CONFIG_KEYS)[number];

export function isConfigKey(value: unknown): value is ConfigKey {
  return typeof value === 'string' && (CONFIG_KEYS as readonly string[]).includes(value);
}

export interface ConfigMessages {
  whatsapp: string;
  instagram: string;
  confirm: string;
}

const MAX_URL_LENGTH = 300;
const INSTAGRAM_HOSTS = new Set(['instagram.com', 'www.instagram.com']);

/**
 * URL de Instagram: `https`, dominio exacto `instagram.com` o `www.instagram.com` (no subdominios ni dominios que
 * solo lo contengan), sin usuario/clave ni puerto. Devuelve la URL normalizada o `null`.
 */
export function normalizeInstagramUrl(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed === '' || trimmed.length > MAX_URL_LENGTH || /[\u0000- \u007f]/.test(trimmed)) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  if (!INSTAGRAM_HOSTS.has(url.hostname)) return null;
  if (url.username !== '' || url.password !== '' || url.port !== '') return null;
  return url.href;
}

/** Valida un valor según su clave; devuelve el valor normalizado listo para guardar. */
export function createConfigValueSchema(key: ConfigKey, m: ConfigMessages) {
  if (key === 'whatsapp_numero') {
    return z
      .string(m.whatsapp)
      .max(60, m.whatsapp)
      .transform((v, ctx) => {
        const normalized = normalizeColombianMobile(v);
        if (!normalized) {
          ctx.addIssue({ code: 'custom', message: m.whatsapp });
          return z.NEVER;
        }
        return normalized;
      });
  }
  return z
    .string(m.instagram)
    .max(MAX_URL_LENGTH + 100, m.instagram)
    .transform((v, ctx) => {
      const normalized = normalizeInstagramUrl(v);
      if (!normalized) {
        ctx.addIssue({ code: 'custom', message: m.instagram });
        return z.NEVER;
      }
      return normalized;
    });
}

/** Casilla de confirmación del formulario (el servidor la exige: no basta con la interfaz). */
export function createConfirmSchema(message: string) {
  return z.literal('on', message);
}
