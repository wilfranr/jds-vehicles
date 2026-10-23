// @vitest-environment node
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { Condicion, EstadoReserva, TipoDocumento } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getUserReservationByCode, listUserReservations, RESERVATIONS_PAGE_SIZE } from './queries';

// BD sembrada; filas temporales con ids 9201+ que se borran siempre (solo las propias).
const BASE = 9201;
const createdUsers = new Set<number>();
const createdVehicles = new Set<number>();
let dbUp = false;
try {
  await prisma.$queryRaw`SELECT 1`;
  dbUp = true;
} catch {
  if (process.env.CI) throw new Error('Las pruebas de reservas necesitan la BD en CI.');
}

async function makeUser(id: number) {
  createdUsers.add(id);
  await prisma.user.create({
    data: {
      id,
      rolId: 1,
      nombre: 'Prueba',
      apellido: 'Consultas',
      tipoDocumento: TipoDocumento.CC,
      documentoIdentidad: `TMQ${id}`,
      email: `tmp-consultas-${id}@example.com`,
      passwordHash: 'x',
      telefono: '573000000000',
    },
  });
}

async function makeVehicle(id: number, withPhoto = false) {
  createdVehicles.add(id);
  await prisma.vehiculo.create({
    data: {
      id,
      modeloId: 1,
      anio: 2021,
      color: 'Temporal',
      condicion: Condicion.USADO,
      placa: 'SECRETA1',
      precio: 1000000,
      fotos: withPhoto
        ? {
            create: [
              {
                urlFoto: 'https://example.com/secundaria.jpg',
                esPrincipal: false,
                ordenPresentacion: 1,
              },
              {
                urlFoto: 'https://example.com/principal.jpg',
                esPrincipal: true,
                ordenPresentacion: 2,
              },
            ],
          }
        : undefined,
    },
  });
}

async function makeReservation(
  userId: number,
  vehicleId: number,
  code: string,
  fechaReserva: Date,
  estado: EstadoReserva = EstadoReserva.PENDIENTE_CONTACTO
) {
  await prisma.reserva.create({
    data: { codigoReserva: code, usuarioId: userId, vehiculoId: vehicleId, estado, fechaReserva },
  });
}

async function cleanup() {
  const vehicleIds = [...createdVehicles];
  const userIds = [...createdUsers];
  await prisma.reserva.deleteMany({
    where: { OR: [{ vehiculoId: { in: vehicleIds } }, { usuarioId: { in: userIds } }] },
  });
  await prisma.vehiculoFoto.deleteMany({ where: { vehiculoId: { in: vehicleIds } } });
  await prisma.vehiculo.deleteMany({ where: { id: { in: vehicleIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  createdVehicles.clear();
  createdUsers.clear();
}

describe.skipIf(!dbUp)('consultas de reservas (BD)', () => {
  afterEach(cleanup);
  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it('un usuario solo ve sus reservas, las más recientes primero, con foto principal y sin placa', async () => {
    await makeUser(BASE);
    await makeUser(BASE + 1);
    await makeVehicle(BASE, true);
    await makeVehicle(BASE + 1);
    await makeReservation(BASE, BASE, 'RES-2026-AAAA', new Date('2026-01-01T10:00:00Z'));
    await makeReservation(BASE, BASE + 1, 'RES-2026-BBBB', new Date('2026-02-01T10:00:00Z'));
    await makeReservation(BASE + 1, BASE + 1, 'RES-2026-CCCC', new Date('2026-03-01T10:00:00Z'));

    const mine = await listUserReservations(BASE);

    expect(mine.total).toBe(2);
    expect(mine.items.map((r) => r.codigo)).toEqual(['RES-2026-BBBB', 'RES-2026-AAAA']);
    expect(mine.items[1]!.vehiculo.fotoUrl).toBe('https://example.com/principal.jpg');
    expect(mine.items[0]!.vehiculo.fotoUrl).toBeNull();
    expect(JSON.stringify(mine)).not.toContain('SECRETA1');

    const other = await listUserReservations(BASE + 1);
    expect(other.items.map((r) => r.codigo)).toEqual(['RES-2026-CCCC']);
  });

  it('un usuario sin reservas obtiene una lista vacía', async () => {
    await makeUser(BASE);
    expect(await listUserReservations(BASE)).toMatchObject({ items: [], total: 0, pageCount: 1 });
  });

  it('abrir por código: la propia se devuelve y la ajena es indistinguible de una inexistente', async () => {
    await makeUser(BASE);
    await makeUser(BASE + 1);
    await makeVehicle(BASE);
    await makeReservation(BASE, BASE, 'RES-2026-AAAA', new Date());

    expect((await getUserReservationByCode(BASE, 'RES-2026-AAAA'))?.vehiculo.marca).toBeTruthy();
    expect(await getUserReservationByCode(BASE + 1, 'RES-2026-AAAA')).toBeNull();
    expect(await getUserReservationByCode(BASE, 'RES-2026-ZZZZ')).toBeNull();
  });

  it('pagina de 20 en 20 y acota páginas fuera de rango', async () => {
    await makeUser(BASE);
    await makeVehicle(BASE);
    const total = RESERVATIONS_PAGE_SIZE + 3;
    for (let i = 0; i < total; i++) {
      const suffix = `${'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(i / 5)]}${'23456'[i % 5]}AA`;
      await makeReservation(
        BASE,
        BASE,
        `RES-2026-${suffix}`,
        new Date(Date.UTC(2026, 0, 1, 0, 0, i)),
        EstadoReserva.CANCELADA
      );
    }

    const first = await listUserReservations(BASE, 1);
    const second = await listUserReservations(BASE, 2);
    expect(first.items).toHaveLength(RESERVATIONS_PAGE_SIZE);
    expect(second.items).toHaveLength(3);
    expect(first).toMatchObject({ total, pageCount: 2, page: 1 });
    expect((await listUserReservations(BASE, 99)).page).toBe(2);
    expect((await listUserReservations(BASE, -4)).page).toBe(1);
  });
});
