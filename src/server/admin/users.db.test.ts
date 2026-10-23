// @vitest-environment node
import bcrypt from 'bcryptjs';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { Condicion, EstadoReserva, TipoDocumento } from '@prisma/client';
import { prisma } from '@/lib/db';
import { verifyCredentials } from '@/server/auth/verify-credentials';
import {
  listAdminUsers,
  maskDocument,
  setUserActive,
  setUserPasswordHash,
  setUserRole,
} from './users';

// BD sembrada; usuarios temporales con ids 9801+ borrados siempre. Las pruebas de «último ADMIN» necesitan que el
// administrador del seed sea el único ADMIN activo (se restaura siempre en afterEach/afterAll).
const BASE = 9801;
const createdUsers = new Set<number>();
const createdVehicles = new Set<number>();
let dbUp = false;
try {
  await prisma.$queryRaw`SELECT 1`;
  dbUp = true;
} catch {
  if (process.env.CI) throw new Error('Las pruebas del panel necesitan la BD en CI.');
}

async function role(name: 'CLIENTE' | 'ASESOR' | 'ADMIN') {
  return (await prisma.role.findUniqueOrThrow({ where: { nombre: name } })).id;
}

async function makeUser(
  id: number,
  rol: 'CLIENTE' | 'ASESOR' | 'ADMIN' = 'CLIENTE',
  overrides: { activo?: boolean; email?: string; documento?: string } = {}
) {
  createdUsers.add(id);
  await prisma.user.create({
    data: {
      id,
      rolId: await role(rol),
      nombre: 'Prueba',
      apellido: `Usuarios${id}`,
      tipoDocumento: TipoDocumento.CC,
      documentoIdentidad: overrides.documento ?? `TMU${id}`,
      email: overrides.email ?? `tmp-usuarios-${id}@example.com`,
      passwordHash: await bcrypt.hash('Original-Clave-1', 4),
      telefono: '573000000000',
      activo: overrides.activo ?? true,
    },
  });
}

const activeAdmins = () => prisma.user.count({ where: { activo: true, rol: { nombre: 'ADMIN' } } });
const userOf = (id: number) =>
  prisma.user.findUniqueOrThrow({ where: { id }, include: { rol: true } });

async function restoreSeedAdmin() {
  await prisma.user.updateMany({
    where: { email: 'admin@jdsvehiculos.com' },
    data: { activo: true, rolId: await role('ADMIN') },
  });
}

async function cleanup() {
  const ids = [...createdUsers];
  const vehicleIds = [...createdVehicles];
  await prisma.reserva.deleteMany({
    where: { OR: [{ usuarioId: { in: ids } }, { vehiculoId: { in: vehicleIds } }] },
  });
  await prisma.vehiculo.deleteMany({ where: { id: { in: vehicleIds } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  createdUsers.clear();
  createdVehicles.clear();
  await restoreSeedAdmin();
}

/** Deja a los administradores temporales como únicos ADMIN activos (el del seed se desactiva hasta `cleanup`). */
async function suspendSeedAdmin() {
  await prisma.user.updateMany({
    where: { email: 'admin@jdsvehiculos.com' },
    data: { activo: false },
  });
}

describe('maskDocument', () => {
  it('deja visibles solo los 3 últimos caracteres', () => {
    expect(maskDocument('7712345678')).toBe('*******678');
    expect(maskDocument('AB')).toBe('**');
  });
});

describe.skipIf(!dbUp)('gestión de usuarios (BD)', () => {
  beforeAll(restoreSeedAdmin);
  afterEach(cleanup);
  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it('el listado busca por nombre o correo, enmascara el documento y no expone el hash', async () => {
    await makeUser(BASE, 'CLIENTE', {
      email: 'busqueda-uno-9801@example.com',
      documento: '7712345678',
    });
    await makeUser(BASE + 1);

    const byEmail = await listAdminUsers({ q: 'busqueda-uno-9801', page: 1 });
    expect(byEmail.items).toHaveLength(1);
    expect(byEmail.items[0]).toMatchObject({
      id: BASE,
      rol: 'CLIENTE',
      activo: true,
      documentoEnmascarado: '*******678',
      activeReservations: 0,
    });
    const serialized = JSON.stringify(byEmail);
    expect(serialized).not.toContain('7712345678');
    expect(serialized).not.toMatch(/passwordHash|password_hash|\$2[aby]\$/);

    const byName = await listAdminUsers({ q: `Usuarios${BASE + 1}`, page: 1 });
    expect(byName.items.map((u) => u.id)).toEqual([BASE + 1]);
  });

  it('la búsqueda es parametrizada: cadenas de inyección no devuelven filas ni rompen nada', async () => {
    await makeUser(BASE);
    for (const q of ["' OR 1=1 --", '"; DROP TABLE usuarios; --', "x' UNION SELECT 1 --"]) {
      expect((await listAdminUsers({ q, page: 1 })).total).toBe(0);
    }
    expect(await prisma.user.count({ where: { id: BASE } })).toBe(1);
  });

  it('desactivar y volver a activar una cuenta; las reservas activas se informan pero no se cancelan', async () => {
    await makeUser(BASE);
    await makeUser(BASE + 1, 'ADMIN');
    createdVehicles.add(BASE);
    await prisma.vehiculo.create({
      data: {
        id: BASE,
        modeloId: 1,
        anio: 2023,
        color: 'Temporal',
        condicion: Condicion.NUEVO,
        precio: 1000000,
      },
    });
    await prisma.reserva.create({
      data: {
        codigoReserva: 'RES-2026-UA22',
        usuarioId: BASE,
        vehiculoId: BASE,
        estado: EstadoReserva.PENDIENTE_CONTACTO,
      },
    });

    expect(await setUserActive(BASE + 1, BASE, false)).toEqual({
      status: 'ok',
      id: BASE,
      activeReservations: 1,
    });
    expect((await userOf(BASE)).activo).toBe(false);
    expect(
      (await prisma.reserva.findUniqueOrThrow({ where: { codigoReserva: 'RES-2026-UA22' } })).estado
    ).toBe('PENDIENTE_CONTACTO');

    expect(await setUserActive(BASE + 1, BASE, true)).toMatchObject({ status: 'ok' });
    expect((await userOf(BASE)).activo).toBe(true);
  });

  it('un usuario desactivado no puede iniciar sesión', async () => {
    await makeUser(BASE, 'CLIENTE', { email: 'login-9801@example.com' });
    await makeUser(BASE + 1, 'ADMIN');
    const deps = {
      findUserByEmail: (email: string) =>
        prisma.user.findUnique({ where: { email }, include: { rol: true } }),
      comparePassword: (plain: string, hash: string) => bcrypt.compare(plain, hash),
    };
    expect(
      await verifyCredentials('login-9801@example.com', 'Original-Clave-1', deps)
    ).not.toBeNull();

    await setUserActive(BASE + 1, BASE, false);
    expect(await verifyCredentials('login-9801@example.com', 'Original-Clave-1', deps)).toBeNull();
  });

  it('cambiar el rol de un usuario', async () => {
    await makeUser(BASE);
    await makeUser(BASE + 1, 'ADMIN');

    expect(await setUserRole(BASE + 1, BASE, 'ASESOR')).toMatchObject({ status: 'ok' });
    expect((await userOf(BASE)).rol.nombre).toBe('ASESOR');
    expect(await setUserRole(BASE + 1, BASE, 'ADMIN')).toMatchObject({ status: 'ok' });
    expect((await userOf(BASE)).rol.nombre).toBe('ADMIN');
  });

  it('un administrador no puede desactivarse ni quitarse el rol a sí mismo', async () => {
    await makeUser(BASE, 'ADMIN');
    expect(await setUserActive(BASE, BASE, false)).toEqual({ status: 'self_forbidden' });
    expect(await setUserRole(BASE, BASE, 'CLIENTE')).toEqual({ status: 'self_forbidden' });
    expect(await setUserRole(BASE, BASE, 'ADMIN')).toMatchObject({ status: 'ok' }); // sin cambio: permitido
    const after = await userOf(BASE);
    expect(after).toMatchObject({ activo: true });
    expect(after.rol.nombre).toBe('ADMIN');
  });

  it('el único ADMIN activo no se puede desactivar ni degradar', async () => {
    expect(await activeAdmins()).toBe(1); // el del seed
    await makeUser(BASE, 'ASESOR'); // quien actúa (en el producto siempre es un ADMIN)
    const seedAdmin = await prisma.user.findUniqueOrThrow({
      where: { email: 'admin@jdsvehiculos.com' },
    });

    expect(await setUserActive(BASE, seedAdmin.id, false)).toEqual({ status: 'last_admin' });
    expect(await setUserRole(BASE, seedAdmin.id, 'CLIENTE')).toEqual({ status: 'last_admin' });
    expect(await setUserRole(BASE, seedAdmin.id, 'ASESOR')).toEqual({ status: 'last_admin' });
    expect(await activeAdmins()).toBe(1);
    expect((await userOf(seedAdmin.id)).activo).toBe(true);
  });

  it('con otro ADMIN activo sí se puede desactivar o degradar a uno', async () => {
    await makeUser(BASE, 'ADMIN');
    await makeUser(BASE + 1, 'ADMIN');
    expect(await setUserRole(BASE, BASE + 1, 'ASESOR')).toMatchObject({ status: 'ok' });
    await setUserRole(BASE, BASE + 1, 'ADMIN');
    expect(await setUserActive(BASE, BASE + 1, false)).toMatchObject({ status: 'ok' });
    expect(await activeAdmins()).toBeGreaterThanOrEqual(1);
  });

  it('carrera: dos administradores que se desactivan mutuamente a la vez → solo uno lo logra', async () => {
    await suspendSeedAdmin();
    await makeUser(BASE, 'ADMIN');
    await makeUser(BASE + 1, 'ADMIN');
    expect(await activeAdmins()).toBe(2);

    const results = await Promise.all([
      setUserActive(BASE, BASE + 1, false),
      setUserActive(BASE + 1, BASE, false),
    ]);

    expect(results.map((r) => r.status).sort()).toEqual(['last_admin', 'ok']);
    expect(await activeAdmins()).toBe(1);
  });

  it('carrera: dos administradores que se degradan mutuamente a la vez → siempre queda uno', async () => {
    await suspendSeedAdmin();
    await makeUser(BASE, 'ADMIN');
    await makeUser(BASE + 1, 'ADMIN');

    const results = await Promise.all([
      setUserRole(BASE, BASE + 1, 'ASESOR'),
      setUserRole(BASE + 1, BASE, 'ASESOR'),
    ]);

    expect(results.map((r) => r.status).sort()).toEqual(['last_admin', 'ok']);
    expect(await activeAdmins()).toBe(1);
  });

  it('usuario inexistente → not_found; restablecer la propia contraseña no está permitido', async () => {
    await makeUser(BASE, 'ADMIN');
    expect(await setUserActive(BASE, 4_000_000_000, false)).toEqual({ status: 'not_found' });
    expect(await setUserRole(BASE, 4_000_000_000, 'ASESOR')).toEqual({ status: 'not_found' });
    expect(await setUserPasswordHash(BASE, 4_000_000_000, 'x')).toEqual({ status: 'not_found' });
    expect(await setUserPasswordHash(BASE, BASE, 'x')).toEqual({ status: 'self_forbidden' });
  });

  it('restablecer la contraseña: la temporal sirve y la anterior deja de servir', async () => {
    await makeUser(BASE, 'CLIENTE', { email: 'reset-9801@example.com' });
    await makeUser(BASE + 1, 'ADMIN');
    const deps = {
      findUserByEmail: (email: string) =>
        prisma.user.findUnique({ where: { email }, include: { rol: true } }),
      comparePassword: (plain: string, hash: string) => bcrypt.compare(plain, hash),
    };

    const temporary = 'Temporal-Clave-9';
    expect(await setUserPasswordHash(BASE + 1, BASE, await bcrypt.hash(temporary, 4))).toEqual({
      status: 'ok',
      id: BASE,
    });
    expect(await verifyCredentials('reset-9801@example.com', temporary, deps)).not.toBeNull();
    expect(await verifyCredentials('reset-9801@example.com', 'Original-Clave-1', deps)).toBeNull();
  });
});
