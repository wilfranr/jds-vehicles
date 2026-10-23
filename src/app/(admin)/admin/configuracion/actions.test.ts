import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const requireAdmin = vi.fn();
const saveConfigValue = vi.fn();
const updateTag = vi.fn();

vi.mock('@/server/auth/staff', () => ({ requireAdmin: (p: string) => requireAdmin(p) }));
vi.mock('@/server/admin/dealer-config', () => ({
  saveConfigValue: (...a: unknown[]) => saveConfigValue(...a),
}));
vi.mock('next/cache', () => ({
  updateTag: (t: string) => updateTag(t),
  revalidatePath: vi.fn(),
}));

import { siteContent } from '@/lib/site-content';
import { updateConfigAction } from './actions';

const copy = siteContent.adminConfig;
let output: string[];

beforeEach(() => {
  output = [];
  vi.spyOn(console, 'info').mockImplementation(
    (...a: unknown[]) => void output.push(a.map(String).join(' '))
  );
  requireAdmin.mockReset().mockResolvedValue({ id: 1, rol: 'ADMIN', name: 'A', email: 'a@x.com' });
  saveConfigValue.mockReset().mockResolvedValue({ status: 'ok', previous: '573202353168' });
  updateTag.mockReset();
});
afterEach(() => vi.restoreAllMocks());

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
}

describe('updateConfigAction', () => {
  it('guarda el número normalizado, invalida la caché de la configuración y audita valor anterior y nuevo', async () => {
    const state = await updateConfigAction(
      'whatsapp_numero',
      {},
      form({ valor: '+57 310 555 1234', confirmar: 'on' })
    );

    expect(state).toEqual({ success: copy.saved });
    expect(saveConfigValue).toHaveBeenCalledWith('whatsapp_numero', '573105551234');
    expect(updateTag).toHaveBeenCalledWith('dealer-config');
    const logged = JSON.parse(output[0]!);
    expect(logged).toMatchObject({
      channel: 'admin',
      action: 'config_changed',
      actorId: 1,
      detail: 'whatsapp_numero: 573202353168 → 573105551234',
    });
  });

  it('exige ADMIN antes de hacer nada', async () => {
    requireAdmin.mockRejectedValue(new Error('NOT_FOUND'));
    await expect(
      updateConfigAction('whatsapp_numero', {}, form({ valor: '3105551234', confirmar: 'on' }))
    ).rejects.toThrow('NOT_FOUND');
    expect(saveConfigValue).not.toHaveBeenCalled();
    expect(updateTag).not.toHaveBeenCalled();
  });

  it('rechaza una clave desconocida (lista blanca)', async () => {
    for (const key of ['whatsapp_mensaje_plantilla', 'admin', '__proto__', '']) {
      expect(await updateConfigAction(key, {}, form({ valor: 'x', confirmar: 'on' }))).toEqual({
        error: copy.errors.unknownKey,
      });
    }
    expect(saveConfigValue).not.toHaveBeenCalled();
  });

  it('rechaza valores inválidos sin guardar ni invalidar la caché', async () => {
    expect(
      await updateConfigAction('whatsapp_numero', {}, form({ valor: '12345', confirmar: 'on' }))
    ).toEqual({ error: copy.errors.whatsapp });
    expect(
      await updateConfigAction(
        'instagram_url',
        {},
        form({ valor: 'https://evil.com/x', confirmar: 'on' })
      )
    ).toEqual({ error: copy.errors.instagram });
    expect(
      await updateConfigAction(
        'instagram_url',
        {},
        form({ valor: 'https://instagram.com.evil.com/x', confirmar: 'on' })
      )
    ).toEqual({ error: copy.errors.instagram });
    expect(saveConfigValue).not.toHaveBeenCalled();
    expect(updateTag).not.toHaveBeenCalled();
  });

  it('exige la casilla de confirmación en el servidor', async () => {
    expect(await updateConfigAction('whatsapp_numero', {}, form({ valor: '3105551234' }))).toEqual({
      error: copy.errors.confirm,
    });
    expect(
      await updateConfigAction(
        'whatsapp_numero',
        {},
        form({ valor: '3105551234', confirmar: 'yes' })
      )
    ).toEqual({ error: copy.errors.confirm });
    expect(saveConfigValue).not.toHaveBeenCalled();
  });

  it('ignora campos extra del formulario (clave, id): solo se leen valor y confirmar', async () => {
    await updateConfigAction(
      'whatsapp_numero',
      {},
      form({ valor: '3105551234', confirmar: 'on', clave: 'instagram_url', id: '9' })
    );
    expect(saveConfigValue).toHaveBeenCalledWith('whatsapp_numero', '573105551234');
  });
});
