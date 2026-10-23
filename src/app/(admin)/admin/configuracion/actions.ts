'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { siteContent } from '@/lib/site-content';
import {
  createConfigValueSchema,
  createConfirmSchema,
  isConfigKey,
} from '@/lib/validation/dealer-config';
import { logAdminEvent } from '@/server/admin/audit';
import type { ConfigFormState } from '@/server/admin/config-form-state';
import { saveConfigValue } from '@/server/admin/dealer-config';
import { requireAdmin } from '@/server/auth/staff';

const copy = siteContent.adminConfig;
const messages = {
  whatsapp: copy.errors.whatsapp,
  instagram: copy.errors.instagram,
  confirm: copy.errors.confirm,
};
const confirmSchema = createConfirmSchema(copy.errors.confirm);

/**
 * Guarda una clave de la lista blanca. La clave llega enlazada desde la página y se valida contra la lista
 * (una clave desconocida se rechaza); del formulario solo se leen `valor` y `confirmar`. Solo ADMIN.
 */
export async function updateConfigAction(
  rawKey: string,
  _previous: ConfigFormState,
  formData: FormData
): Promise<ConfigFormState> {
  const admin = await requireAdmin('/admin/configuracion');
  if (!isConfigKey(rawKey)) return { error: copy.errors.unknownKey };

  const value = createConfigValueSchema(rawKey, messages).safeParse(formData.get('valor') ?? '');
  if (!value.success) return { error: value.error.issues[0]?.message ?? copy.errors.generic };
  if (!confirmSchema.safeParse(formData.get('confirmar')).success) {
    return { error: copy.errors.confirm };
  }

  const result = await saveConfigValue(rawKey, value.data);
  if (result.status !== 'ok') return { error: copy.errors.unknownKey };

  // Son datos del negocio (no personales): se registran el valor anterior y el nuevo.
  logAdminEvent({
    actorId: admin.id,
    action: 'config_changed',
    entity: 'config',
    detail: `${rawKey}: ${result.previous ?? '(sin valor)'} → ${value.data}`,
  });
  // Header, pie, botón flotante y enlaces de reserva dependen de `getDealerConfig()` (etiqueta `dealer-config`).
  updateTag('dealer-config');
  revalidatePath('/admin/configuracion');
  return { success: copy.saved };
}
