// @vitest-environment node
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { Condicion, Disponibilidad, EstadoReserva, TipoDocumento } from '@prisma/client';
import { prisma } from '@/lib/db';
import {
  changeReservationState,
  getAdminReservation,
  listAdminReservations,
  saveReservationNotes,
} from './reservations';

// BD sembrada; filas temporales con ids 9701+ de usuario/vehículo, borradas siempre (solo las propias).
const BASE = 9701;
const createdUsers = new Set<number>();
const createdVehicles = new Set<number>();
let dbUp = false;
try {
  await prisma.$queryRaw`SELECT 1`;
  dbUp = true;
} catch {
  if (process.env.CI) throw new Error('Las pruebas del panel necesitan la BD en CI.');
}

async function makeUser(id: number, overrides: { email?: string; documento?: string } = {}) {
  createdUsers.add(id);
  await prisma.user.create({
    data: {
      id,
      rolId: 1,
      nombre: 'Prueba',
      apellido: 'Reservas',
      tipoDocumento: TipoDocumento.CC,
      documentoIdentidad: overrides.documento ?? `TMR${id}`,
      email: overrides.email ?? `tmp-admin-res-${id}@example.com`,
      passwordHash: '$2b$12$secretsecretsecretsecretsecretsecretsecretsecretsecretse',
      telefono: '573105559999',
      ciudad: 'Cali',
    },
  });
}

async function makeVehicle(id: number, disponibilidad: Disponibilidad = Disponibilidad.RESERVADO) {
  createdVehicles.add(id);
  await prisma.vehiculo.create({
    data: {
      id,
      modeloId: 1,
      anio: 2023,
      color: 'Temporal',
      condicion: Condicion.USADO,
      placa: `TMR${id}`,
      precio: 77000000,
      disponibilidad,
    },
  });
}

async function makeReservation(
  code: string,
  vehiculoId: number,
  usuarioId: number,
  estado: EstadoReserva = EstadoReserva.PENDIENTE_CONTACTO,
  fechaReserva = new Date()
) {
  return prisma.reserva.create({
    data: { codigoReserva: code, vehiculoId, usuarioId, estado, fechaReserva },
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

const availabilityOf = async (id: number) =>
  (await prisma.vehiculo.findUniqueOrThrow({ where: { id } })).disponibilidad;
const stateOf = async (code: string) =>
  (await prisma.reserva.findUniqueOrThrow({ where: { codigoReserva: code } })).estado;

describe.skipIf(!dbUp)('reservas del personal (BD)', () => {
  afterEach(cleanup);
  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it('cancelar: la reserva queda CANCELADA, el vehículo DISPONIBLE y el motivo en las observaciones', async () => {
    await makeUser(BASE);
    await makeVehicle(BASE);
    await makeReservation('RES-2026-QA22', BASE, BASE);

    const result = await changeReservationState(
      'RES-2026-QA22',
      'CANCELADA',
      'Cliente no responde'
    );

    expect(result).toMatchObject({ status: 'ok', vehicleReleased: true });
    expect(await stateOf('RES-2026-QA22')).toBe('CANCELADA');
    expect(await availabilityOf(BASE)).toBe('DISPONIBLE');
    const row = await prisma.reserva.findUniqueOrThrow({
      where: { codigoReserva: 'RES-2026-QA22' },
    });
    expect(row.observaciones).toBe('Cancelación: Cliente no responde');
  });

  it('iniciar negociación: PENDIENTE → EN_NEGOCIACION sin tocar el vehículo; luego puede cancelarse', async () => {
    await makeUser(BASE);
    await makeVehicle(BASE);
    await makeReservation('RES-2026-QB22', BASE, BASE);

    expect(await changeReservationState('RES-2026-QB22', 'EN_NEGOCIACION')).toMatchObject({
      status: 'ok',
      vehicleReleased: false,
    });
    expect(await availabilityOf(BASE)).toBe('RESERVADO');
    expect(await changeReservationState('RES-2026-QB22', 'EN_NEGOCIACION')).toEqual({
      status: 'invalid_transition',
      current: 'EN_NEGOCIACION',
    });
    expect(await changeReservationState('RES-2026-QB22', 'CANCELADA')).toMatchObject({
      status: 'ok',
    });
    expect(await availabilityOf(BASE)).toBe('DISPONIBLE');
  });

  it.each(['CANCELADA', 'COMPLETADA', 'EXPIRADA'] as const)(
    'una reserva %s no cambia',
    async (estado) => {
      await makeUser(BASE);
      await makeVehicle(BASE, Disponibilidad.DISPONIBLE);
      await makeReservation('RES-2026-QC22', BASE, BASE, estado);

      expect(await changeReservationState('RES-2026-QC22', 'CANCELADA')).toEqual({
        status: 'invalid_transition',
        current: estado,
      });
      expect(await changeReservationState('RES-2026-QC22', 'EN_NEGOCIACION')).toEqual({
        status: 'invalid_transition',
        current: estado,
      });
      expect(await stateOf('RES-2026-QC22')).toBe(estado);
    }
  );

  it('código inexistente → not_found', async () => {
    expect(await changeReservationState('RES-2026-ZZZZ', 'CANCELADA')).toEqual({
      status: 'not_found',
    });
    expect(await saveReservationNotes('RES-2026-ZZZZ', 'x')).toEqual({ status: 'not_found' });
    expect(await getAdminReservation('RES-2026-ZZZZ')).toBeNull();
  });

  it('si el vehículo tiene otra reserva activa, no se libera', async () => {
    await makeUser(BASE);
    await makeUser(BASE + 1);
    await makeVehicle(BASE);
    await makeReservation('RES-2026-QD22', BASE, BASE);
    await makeReservation('RES-2026-QE22', BASE, BASE + 1, EstadoReserva.EN_NEGOCIACION);

    expect(await changeReservationState('RES-2026-QD22', 'CANCELADA')).toMatchObject({
      status: 'ok',
      vehicleReleased: false,
    });
    expect(await availabilityOf(BASE)).toBe('RESERVADO');
  });

  it('dos cancelaciones simultáneas: una efectiva y la otra recibe invalid_transition (sin error)', async () => {
    await makeUser(BASE);
    await makeVehicle(BASE);
    await makeReservation('RES-2026-QF22', BASE, BASE);

    const results = await Promise.all([
      changeReservationState('RES-2026-QF22', 'CANCELADA', 'a'),
      changeReservationState('RES-2026-QF22', 'CANCELADA', 'b'),
      changeReservationState('RES-2026-QF22', 'CANCELADA', 'c'),
    ]);

    expect(results.filter((r) => r.status === 'ok')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'invalid_transition')).toHaveLength(2);
    expect(await availabilityOf(BASE)).toBe('DISPONIBLE');
    const row = await prisma.reserva.findUniqueOrThrow({
      where: { codigoReserva: 'RES-2026-QF22' },
    });
    expect(row.observaciones?.split('\n')).toHaveLength(1);
  });

  it('el detalle enmascara el documento y no expone el hash de la contraseña', async () => {
    await makeUser(BASE, { documento: '7712345678' });
    await makeVehicle(BASE);
    await makeReservation('RES-2026-QG22', BASE, BASE);

    const detail = await getAdminReservation('RES-2026-QG22');
    expect(detail?.cliente).toMatchObject({
      nombre: 'Prueba',
      telefono: '573105559999',
      ciudad: 'Cali',
      documentoEnmascarado: '*******678',
    });
    expect(detail?.vehiculo.placa).toBe(`TMR${BASE}`);
    const serialized = JSON.stringify(detail);
    expect(serialized).not.toContain('7712345678');
    expect(serialized).not.toMatch(/secretsecret|passwordHash|password_hash/);
  });

  it('listado: activas primero, filtro por estado, búsqueda por código y por correo', async () => {
    await makeUser(BASE, { email: 'busca-uno-9701@example.com' });
    await makeUser(BASE + 1, { email: 'busca-dos-9702@example.com' });
    await makeVehicle(BASE);
    await makeVehicle(BASE + 1);
    await makeVehicle(BASE + 2);
    const future = new Date(Date.now() + 86_400_000);
    // la cancelada es la más reciente, pero las activas deben ir antes
    await makeReservation(
      'RES-2026-QH22',
      BASE,
      BASE,
      EstadoReserva.PENDIENTE_CONTACTO,
      new Date()
    );
    await makeReservation('RES-2026-QJ22', BASE + 1, BASE + 1, EstadoReserva.CANCELADA, future);
    await makeReservation(
      'RES-2026-QK22',
      BASE + 2,
      BASE,
      EstadoReserva.EN_NEGOCIACION,
      new Date()
    );

    const byEmail = await listAdminReservations({ q: 'busca-uno-9701', page: 1 });
    expect(byEmail.items.map((r) => r.codigo).sort()).toEqual(['RES-2026-QH22', 'RES-2026-QK22']);

    const byCode = await listAdminReservations({ q: 'res-2026-qj22', page: 1 });
    expect(byCode.items.map((r) => r.codigo)).toEqual(['RES-2026-QJ22']);

    const onlyCancelled = await listAdminReservations({
      q: 'busca-',
      estado: 'CANCELADA',
      page: 1,
    });
    expect(onlyCancelled.items.map((r) => r.codigo)).toEqual(['RES-2026-QJ22']);

    const both = await listAdminReservations({ q: 'busca-', page: 1 });
    const order = both.items.map((r) => r.codigo);
    expect(order.indexOf('RES-2026-QJ22')).toBe(order.length - 1);
  });

  it('la búsqueda es parametrizada: una cadena de inyección solo devuelve cero filas, sin error', async () => {
    await makeUser(BASE);
    await makeVehicle(BASE);
    await makeReservation('RES-2026-QL22', BASE, BASE);

    for (const q of [
      "' OR 1=1 --",
      '%',
      '_',
      "RES-' OR '1'='1",
      '\\',
      '"; DROP TABLE reservas; --',
    ]) {
      const result = await listAdminReservations({ q, page: 1 });
      expect(
        result.items.every((r) => r.codigo !== 'RES-2026-QL22' || q === '%' || q === '_')
      ).toBe(true);
    }
    expect(await prisma.reserva.count({ where: { codigoReserva: 'RES-2026-QL22' } })).toBe(1);
    expect((await listAdminReservations({ q: "' OR 1=1 --", page: 1 })).total).toBe(0);
  });

  it('las observaciones se guardan literalmente (el escape ocurre al mostrarlas) y vacío las borra', async () => {
    await makeUser(BASE);
    await makeVehicle(BASE);
    await makeReservation('RES-2026-QM22', BASE, BASE);
    const hostile = '<script>alert(1)</script> & "comillas"';

    expect(await saveReservationNotes('RES-2026-QM22', hostile)).toMatchObject({ status: 'ok' });
    expect((await getAdminReservation('RES-2026-QM22'))?.observaciones).toBe(hostile);

    await saveReservationNotes('RES-2026-QM22', '');
    expect((await getAdminReservation('RES-2026-QM22'))?.observaciones).toBeNull();
  });

  it('paginación: tramo de activas y luego el de las demás sin repetir ni perder filas', async () => {
    await makeUser(BASE);
    await makeVehicle(BASE, Disponibilidad.DISPONIBLE);
    const total = 23;
    for (let i = 0; i < total; i++) {
      const code = `RES-2026-P${'ABCDEFGHJKLMNPQRSTUVWXYZ'[i]}22`;
      await makeReservation(
        code,
        BASE,
        BASE,
        i % 2 === 0 ? EstadoReserva.PENDIENTE_CONTACTO : EstadoReserva.CANCELADA,
        new Date(Date.UTC(2026, 0, 1, 0, 0, i))
      );
    }
    const page1 = await listAdminReservations({ q: 'RES-2026-P', page: 1 });
    const page2 = await listAdminReservations({ q: 'RES-2026-P', page: 2 });
    expect(page1.total).toBe(total);
    expect(page1.items).toHaveLength(20);
    expect(page2.items).toHaveLength(3);
    const all = [...page1.items, ...page2.items].map((r) => r.codigo);
    expect(new Set(all).size).toBe(total);
    // 12 activas (índices pares) van primero
    expect(page1.items.slice(0, 12).every((r) => r.estado === 'PENDIENTE_CONTACTO')).toBe(true);
    expect(page1.items.slice(12).every((r) => r.estado === 'CANCELADA')).toBe(true);
  });
});
