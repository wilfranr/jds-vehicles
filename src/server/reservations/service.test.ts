// @vitest-environment node
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { Condicion, Disponibilidad, EstadoReserva, TipoDocumento } from '@prisma/client';
import { prisma } from '@/lib/db';
import { CODE_PATTERN } from './code';
import { createReservation, type CreateReservationDeps } from './service';

// Pruebas contra la BD sembrada (necesita el modelo `modelos.id = 1` y el rol `CLIENTE`). Los datos
// temporales usan ids 9001+ y se borran siempre (solo los que esta prueba creó: otras pruebas comparten la BD). En CI la BD es obligatoria; en local, sin BD, se omiten.
const BASE = 9001;
const createdUsers = new Set<number>();
const createdVehicles = new Set<number>();
let dbUp = false;
try {
  await prisma.$queryRaw`SELECT 1`;
  dbUp = true;
} catch {
  if (process.env.CI) throw new Error('Las pruebas de reservas necesitan la BD en CI.');
}

const NOW = new Date('2026-10-23T12:00:00.000Z');

function deps(overrides: Partial<CreateReservationDeps> = {}): CreateReservationDeps {
  return {
    db: prisma,
    invalidateCache: vi.fn(),
    logEvent: vi.fn(),
    now: () => NOW,
    expirationHours: null,
    ...overrides,
  };
}

async function makeUser(id: number, activo = true) {
  createdUsers.add(id);
  await prisma.user.create({
    data: {
      id,
      rolId: 1,
      nombre: 'Prueba',
      apellido: 'Reservas',
      tipoDocumento: TipoDocumento.CC,
      documentoIdentidad: `TMP${id}`,
      email: `tmp-reservas-${id}@example.com`,
      passwordHash: 'x',
      telefono: '573000000000',
      activo,
    },
  });
}

async function makeVehicle(
  id: number,
  overrides: { disponibilidad?: Disponibilidad; visibleCatalogo?: boolean } = {}
) {
  createdVehicles.add(id);
  await prisma.vehiculo.create({
    data: {
      id,
      modeloId: 1,
      anio: 2024,
      color: 'Temporal',
      condicion: Condicion.NUEVO,
      precio: 1000000,
      disponibilidad: overrides.disponibilidad ?? Disponibilidad.DISPONIBLE,
      visibleCatalogo: overrides.visibleCatalogo ?? true,
    },
  });
}

async function cleanup() {
  const vehicleIds = [...createdVehicles];
  const userIds = [...createdUsers];
  await prisma.reserva.deleteMany({
    where: { OR: [{ vehiculoId: { in: vehicleIds } }, { usuarioId: { in: userIds } }] },
  });
  await prisma.vehiculo.deleteMany({ where: { id: { in: vehicleIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  createdVehicles.clear();
  createdUsers.clear();
}

describe.skipIf(!dbUp)('createReservation (BD)', () => {
  afterEach(cleanup);
  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it('crea la reserva, marca el vehículo RESERVADO, invalida la caché y registra el evento', async () => {
    await makeUser(BASE);
    await makeVehicle(BASE);
    const d = deps();

    const result = await createReservation({ userId: BASE, vehicleId: BASE }, d);

    expect(result.status).toBe('created');
    if (result.status !== 'created') return;
    expect(result.reservation.codigoReserva).toMatch(CODE_PATTERN);
    expect(result.reservation.fechaExpiracion).toBeNull();

    const row = await prisma.reserva.findUniqueOrThrow({ where: { id: result.reservation.id } });
    expect(row).toMatchObject({
      usuarioId: BASE,
      vehiculoId: BASE,
      estado: EstadoReserva.PENDIENTE_CONTACTO,
    });
    expect((await prisma.vehiculo.findUniqueOrThrow({ where: { id: BASE } })).disponibilidad).toBe(
      Disponibilidad.RESERVADO
    );
    expect(d.invalidateCache).toHaveBeenCalledTimes(1);
    expect(d.logEvent).toHaveBeenCalledWith({
      type: 'reservation_created',
      userId: BASE,
      vehicleId: BASE,
      reservationId: row.id,
    });
  });

  it('con expiración configurada, fechaExpiracion queda a esas horas', async () => {
    await makeUser(BASE);
    await makeVehicle(BASE);

    const result = await createReservation(
      { userId: BASE, vehicleId: BASE },
      deps({ expirationHours: 24 })
    );

    expect(result.status === 'created' && result.reservation.fechaExpiracion?.toISOString()).toBe(
      '2026-10-24T12:00:00.000Z'
    );
  });

  it.each([
    ['vendido', { disponibilidad: Disponibilidad.VENDIDO }],
    ['reservado', { disponibilidad: Disponibilidad.RESERVADO }],
    ['próximamente', { disponibilidad: Disponibilidad.PROXIMAMENTE }],
    ['oculto del catálogo', { visibleCatalogo: false }],
  ])('vehículo %s → not_available, sin escribir nada', async (_name, overrides) => {
    await makeUser(BASE);
    await makeVehicle(BASE, overrides);
    const d = deps();

    expect(await createReservation({ userId: BASE, vehicleId: BASE }, d)).toEqual({
      status: 'not_available',
    });
    expect(await prisma.reserva.count({ where: { vehiculoId: BASE } })).toBe(0);
    expect(d.invalidateCache).not.toHaveBeenCalled();
    expect(d.logEvent).toHaveBeenCalledWith({
      type: 'reservation_rejected',
      userId: BASE,
      vehicleId: BASE,
      reason: 'not_available',
    });
  });

  it('vehículo inexistente → not_available', async () => {
    await makeUser(BASE);
    expect(await createReservation({ userId: BASE, vehicleId: BASE + 500 }, deps())).toEqual({
      status: 'not_available',
    });
  });

  it('usuario inactivo o inexistente → inactive_user, y el vehículo sigue DISPONIBLE', async () => {
    await makeUser(BASE, false);
    await makeVehicle(BASE);

    expect(await createReservation({ userId: BASE, vehicleId: BASE }, deps())).toEqual({
      status: 'inactive_user',
    });
    expect(await createReservation({ userId: BASE + 9, vehicleId: BASE }, deps())).toEqual({
      status: 'inactive_user',
    });
    expect((await prisma.vehiculo.findUniqueOrThrow({ where: { id: BASE } })).disponibilidad).toBe(
      Disponibilidad.DISPONIBLE
    );
  });

  it('repetir la reserva del mismo vehículo → already_reserved_by_you', async () => {
    await makeUser(BASE);
    await makeVehicle(BASE);

    await createReservation({ userId: BASE, vehicleId: BASE }, deps());
    expect(await createReservation({ userId: BASE, vehicleId: BASE }, deps())).toEqual({
      status: 'already_reserved_by_you',
    });
    expect(await prisma.reserva.count({ where: { vehiculoId: BASE } })).toBe(1);
  });

  it('una reserva cancelada no cuenta como activa (el usuario puede volver a reservar otro vehículo)', async () => {
    await makeUser(BASE);
    await makeVehicle(BASE);
    await makeVehicle(BASE + 1);
    await makeVehicle(BASE + 2);

    for (const vehicleId of [BASE, BASE + 1]) {
      expect((await createReservation({ userId: BASE, vehicleId }, deps())).status).toBe('created');
    }
    await prisma.reserva.updateMany({
      where: { vehiculoId: BASE },
      data: { estado: EstadoReserva.CANCELADA },
    });
    expect((await createReservation({ userId: BASE, vehicleId: BASE + 2 }, deps())).status).toBe(
      'created'
    );
  });

  it('tope por usuario: la reserva siguiente → limit_reached y el vehículo sigue DISPONIBLE', async () => {
    await makeUser(BASE);
    for (const id of [BASE, BASE + 1, BASE + 2]) await makeVehicle(id);

    expect(
      (await createReservation({ userId: BASE, vehicleId: BASE }, deps({ maxActivePerUser: 2 })))
        .status
    ).toBe('created');
    expect(
      (
        await createReservation(
          { userId: BASE, vehicleId: BASE + 1 },
          deps({ maxActivePerUser: 2 })
        )
      ).status
    ).toBe('created');
    expect(
      await createReservation({ userId: BASE, vehicleId: BASE + 2 }, deps({ maxActivePerUser: 2 }))
    ).toEqual({
      status: 'limit_reached',
    });
    expect(
      (await prisma.vehiculo.findUniqueOrThrow({ where: { id: BASE + 2 } })).disponibilidad
    ).toBe(Disponibilidad.DISPONIBLE);
  });

  it('el tope se respeta aunque un mismo usuario reserve varios vehículos a la vez', async () => {
    await makeUser(BASE);
    const ids = [BASE, BASE + 1, BASE + 2, BASE + 3];
    for (const id of ids) await makeVehicle(id);

    const results = await Promise.all(
      ids.map((vehicleId) =>
        createReservation({ userId: BASE, vehicleId }, deps({ maxActivePerUser: 2 }))
      )
    );

    expect(results.filter((r) => r.status === 'created')).toHaveLength(2);
    expect(results.filter((r) => r.status === 'limit_reached')).toHaveLength(2);
    expect(await prisma.reserva.count({ where: { usuarioId: BASE } })).toBe(2);
  });

  it('colisión de código: reintenta con otro y termina creando la reserva', async () => {
    await makeUser(BASE);
    await makeUser(BASE + 1);
    await makeVehicle(BASE);
    await makeVehicle(BASE + 1);
    await createReservation(
      { userId: BASE, vehicleId: BASE },
      deps({ generateCode: () => 'RES-2026-AAAA' })
    );

    const codes = ['RES-2026-AAAA', 'RES-2026-AAAA', 'RES-2026-BBBB'];
    const result = await createReservation(
      { userId: BASE + 1, vehicleId: BASE + 1 },
      deps({ generateCode: () => codes.shift()! })
    );

    expect(result.status === 'created' && result.reservation.codigoReserva).toBe('RES-2026-BBBB');
    expect(codes).toHaveLength(0);
  });

  it('colisiones persistentes (5 intentos): lanza y revierte todo (vehículo sigue DISPONIBLE, sin filas huérfanas)', async () => {
    await makeUser(BASE);
    await makeUser(BASE + 1);
    await makeVehicle(BASE);
    await makeVehicle(BASE + 1);
    await createReservation(
      { userId: BASE, vehicleId: BASE },
      deps({ generateCode: () => 'RES-2026-AAAA' })
    );
    const d = deps({ generateCode: () => 'RES-2026-AAAA' });

    await expect(createReservation({ userId: BASE + 1, vehicleId: BASE + 1 }, d)).rejects.toThrow();

    expect(
      (await prisma.vehiculo.findUniqueOrThrow({ where: { id: BASE + 1 } })).disponibilidad
    ).toBe(Disponibilidad.DISPONIBLE);
    expect(await prisma.reserva.count({ where: { vehiculoId: BASE + 1 } })).toBe(0);
    expect(d.invalidateCache).not.toHaveBeenCalled();
  });

  it('concurrencia: dos usuarios reservan a la vez el mismo vehículo → una created y una not_available', async () => {
    await makeUser(BASE);
    await makeUser(BASE + 1);
    await makeVehicle(BASE);

    const results = await Promise.all([
      createReservation({ userId: BASE, vehicleId: BASE }, deps()),
      createReservation({ userId: BASE + 1, vehicleId: BASE }, deps()),
    ]);

    expect(results.map((r) => r.status).sort()).toEqual(['created', 'not_available']);
    expect(await prisma.reserva.count({ where: { vehiculoId: BASE } })).toBe(1);
    expect((await prisma.vehiculo.findUniqueOrThrow({ where: { id: BASE } })).disponibilidad).toBe(
      Disponibilidad.RESERVADO
    );
  });

  it('concurrencia: cinco usuarios a la vez → exactamente una reserva', async () => {
    const users = [0, 1, 2, 3, 4].map((n) => BASE + n);
    for (const id of users) await makeUser(id);
    await makeVehicle(BASE);

    const results = await Promise.all(
      users.map((userId) => createReservation({ userId, vehicleId: BASE }, deps()))
    );

    expect(results.filter((r) => r.status === 'created')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'not_available')).toHaveLength(4);
    expect(await prisma.reserva.count({ where: { vehiculoId: BASE } })).toBe(1);
  });
});
