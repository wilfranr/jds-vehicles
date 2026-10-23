// @vitest-environment node
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { listAdminConfig, saveConfigValue } from './dealer-config';

let dbUp = false;
try {
  await prisma.$queryRaw`SELECT 1`;
  dbUp = true;
} catch {
  if (process.env.CI) throw new Error('Las pruebas del panel necesitan la BD en CI.');
}

// Se restauran SIEMPRE los valores originales de la configuración.
let original: { clave: string; valor: string }[] = [];

async function restore() {
  for (const row of original) {
    await prisma.configuracionConcesionario.update({
      where: { clave: row.clave },
      data: { valor: row.valor },
    });
  }
  await prisma.configuracionConcesionario.deleteMany({ where: { clave: 'clave_inventada' } });
}

describe.skipIf(!dbUp)('configuración del concesionario (BD)', () => {
  beforeAll(async () => {
    original = await prisma.configuracionConcesionario.findMany({
      where: { clave: { in: ['whatsapp_numero', 'instagram_url'] } },
      select: { clave: true, valor: true },
    });
  });
  afterEach(restore);
  afterAll(async () => {
    await restore();
    await prisma.$disconnect();
  });

  it('guarda el valor, devuelve el anterior y el panel lo muestra como vigente', async () => {
    const before = original.find((r) => r.clave === 'whatsapp_numero')!.valor;

    expect(await saveConfigValue('whatsapp_numero', '573105551234')).toEqual({
      status: 'ok',
      previous: before,
    });
    const [entry] = await listAdminConfig(['whatsapp_numero']);
    expect(entry).toMatchObject({
      key: 'whatsapp_numero',
      stored: '573105551234',
      effective: '573105551234',
    });
  });

  it('una clave fuera de la lista blanca se rechaza y no escribe nada', async () => {
    for (const key of ['clave_inventada', 'whatsapp_mensaje_plantilla', '']) {
      expect(await saveConfigValue(key, 'x')).toEqual({ status: 'unknown_key' });
    }
    expect(
      await prisma.configuracionConcesionario.count({ where: { clave: 'clave_inventada' } })
    ).toBe(0);
    const template = await prisma.configuracionConcesionario.findUnique({
      where: { clave: 'whatsapp_mensaje_plantilla' },
    });
    expect(template?.valor).not.toBe('x');
  });
});
