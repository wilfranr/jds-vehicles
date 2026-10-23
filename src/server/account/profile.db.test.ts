import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { getProfile } from './profile';

const TAG = `f505${Date.now().toString(36)}`;
let userId = 0;
let inactiveId = 0;

async function user(activo: boolean, suffix: string) {
  const role = await prisma.role.findUniqueOrThrow({ where: { nombre: 'CLIENTE' } });
  return prisma.user.create({
    data: {
      rolId: role.id,
      nombre: 'Perfil',
      apellido: `Prueba${suffix}`,
      documentoIdentidad: `P${TAG}${suffix}`.toUpperCase(),
      email: `perfil-${TAG}${suffix}@example.test`,
      passwordHash: 'hash-que-nunca-debe-salir',
      telefono: '3105551234',
      ciudad: 'Pereira',
      direccion: 'Calle 1',
      activo,
    },
  });
}

beforeAll(async () => {
  userId = (await user(true, 'a')).id;
  inactiveId = (await user(false, 'b')).id;
});
afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [userId, inactiveId] } } });
});

describe('getProfile', () => {
  it('devuelve solo los datos del perfil, nunca el hash ni el rol', async () => {
    const profile = await getProfile(userId);
    expect(profile).toMatchObject({
      nombre: 'Perfil',
      ciudad: 'Pereira',
      direccion: 'Calle 1',
      telefono: '3105551234',
    });
    expect(Object.keys(profile!).sort()).toEqual([
      'apellido',
      'ciudad',
      'direccion',
      'documentoIdentidad',
      'email',
      'nombre',
      'telefono',
      'tipoDocumento',
    ]);
    expect(JSON.stringify(profile)).not.toContain('hash-que-nunca-debe-salir');
  });

  it('devuelve null si la cuenta está desactivada o no existe', async () => {
    expect(await getProfile(inactiveId)).toBeNull();
    expect(await getProfile(4294967295)).toBeNull();
  });
});
