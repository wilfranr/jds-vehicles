// @vitest-environment node
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { Condicion, Disponibilidad, EstadoReserva, TipoDocumento } from '@prisma/client';
import { prisma } from '@/lib/db';
import { expireReservations } from './expire';

// BD sembrada; filas temporales con ids 9401+ que se borran siempre (solo las propias).
const BASE = 9401;
const NOW = new Date('2026-10-23T12:00:00.000Z');
const PAST = new Date('2026-10-23T11:59:59.000Z');
const FUTURE = new Date('2026-10-23T12:00:01.000Z');
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
      apellido: 'Expiración',
      tipoDocumento: TipoDocumento.CC,
      documentoIdentidad: `TME${id}`,
      email: `tmp-expira-${id}@example.com`,
      passwordHash: 'x',
      telefono: '573000000000',
    },
  });
}

async function makeVehicle(id: number, disponibilidad: Disponibilidad = Disponibilidad.RESERVADO) {
  createdVehicles.add(id);
  await prisma.vehiculo.create({
    data: {
      id,
      modeloId: 1,
      anio: 2024,
      color: 'Temporal',
      condicion: Condicion.NUEVO,
      precio: 1000000,
      disponibilidad,
    },
  });
}

let codeCounter = 0;
async function makeReservation(
  vehicleId: number,
  estado: EstadoReserva,
  fechaExpiracion: Date | null,
  userId = BASE
) {
  const suffix = 'ABCDEFGHJKLMNPQRSTUVWXYZ'[codeCounter++ % 24];
  const code = `RES-2026-${suffix}${String(codeCounter).padStart(3, '2').slice(-3).replace(/[01]/g, '2')}`;
  return prisma.reserva.create({
    data: {
      codigoReserva: code,
      usuarioId: userId,
      vehiculoId: vehicleId,
      estado,
      fechaExpiracion,
    },
  });
}

const stateOf = async (id: number) =>
  (await prisma.reserva.findUniqueOrThrow({ where: { id } })).estado;
const availabilityOf = async (id: number) =>
  (await prisma.vehiculo.findUniqueOrThrow({ where: { id } })).disponibilidad;

function deps() {
  return { db: prisma, invalidateCache: vi.fn(), logEvent: vi.fn() };
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

describe.skipIf(!dbUp)('expireReservations (BD, reloj simulado)', () => {
  afterEach(cleanup);
  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it('vence: marca EXPIRADA, libera el vehículo, invalida la caché y registra el evento', async () => {
    await makeUser(BASE);
    await makeVehicle(BASE);
    const reservation = await makeReservation(BASE, EstadoReserva.PENDIENTE_CONTACTO, PAST);
    const d = deps();

    expect(await expireReservations(NOW, d)).toEqual({ expired: 1, vehiclesReleased: 1 });

    expect(await stateOf(reservation.id)).toBe(EstadoReserva.EXPIRADA);
    expect(await availabilityOf(BASE)).toBe(Disponibilidad.DISPONIBLE);
    expect(d.invalidateCache).toHaveBeenCalledTimes(1);
    expect(d.logEvent).toHaveBeenCalledWith({
      type: 'reservations_expired',
      expired: 1,
      vehiclesReleased: 1,
    });
  });

  it('vence exactamente en el instante de expiración (<=) y no un segundo antes', async () => {
    await makeUser(BASE);
    await makeVehicle(BASE);
    await makeVehicle(BASE + 1);
    const atLimit = await makeReservation(BASE, EstadoReserva.PENDIENTE_CONTACTO, NOW);
    const notYet = await makeReservation(BASE + 1, EstadoReserva.PENDIENTE_CONTACTO, FUTURE);

    expect((await expireReservations(NOW, deps())).expired).toBe(1);
    expect(await stateOf(atLimit.id)).toBe(EstadoReserva.EXPIRADA);
    expect(await stateOf(notYet.id)).toBe(EstadoReserva.PENDIENTE_CONTACTO);
    expect(await availabilityOf(BASE + 1)).toBe(Disponibilidad.RESERVADO);
  });

  it('idempotente: la segunda ejecución no cambia nada ni invalida la caché', async () => {
    await makeUser(BASE);
    await makeVehicle(BASE);
    await makeReservation(BASE, EstadoReserva.PENDIENTE_CONTACTO, PAST);
    await expireReservations(NOW, deps());

    const second = deps();
    expect(await expireReservations(NOW, second)).toEqual({ expired: 0, vehiclesReleased: 0 });
    expect(second.invalidateCache).not.toHaveBeenCalled();
    expect(second.logEvent).not.toHaveBeenCalled();
    expect(await availabilityOf(BASE)).toBe(Disponibilidad.DISPONIBLE);
  });

  it('fechaExpiracion = null no expira nunca', async () => {
    await makeUser(BASE);
    await makeVehicle(BASE);
    const reservation = await makeReservation(BASE, EstadoReserva.PENDIENTE_CONTACTO, null);

    expect(await expireReservations(new Date('2099-01-01T00:00:00Z'), deps())).toEqual({
      expired: 0,
      vehiclesReleased: 0,
    });
    expect(await stateOf(reservation.id)).toBe(EstadoReserva.PENDIENTE_CONTACTO);
    expect(await availabilityOf(BASE)).toBe(Disponibilidad.RESERVADO);
  });

  it.each([
    EstadoReserva.EN_NEGOCIACION,
    EstadoReserva.COMPLETADA,
    EstadoReserva.CANCELADA,
    EstadoReserva.EXPIRADA,
  ])('no toca reservas %s aunque su fecha haya pasado', async (estado) => {
    await makeUser(BASE);
    await makeVehicle(BASE);
    const reservation = await makeReservation(BASE, estado, PAST);

    expect((await expireReservations(NOW, deps())).expired).toBe(0);
    expect(await stateOf(reservation.id)).toBe(estado);
    expect(await availabilityOf(BASE)).toBe(Disponibilidad.RESERVADO);
  });

  it('si el vehículo tiene otra reserva activa, no vuelve a DISPONIBLE', async () => {
    await makeUser(BASE);
    await makeUser(BASE + 1);
    await makeVehicle(BASE);
    const expiring = await makeReservation(BASE, EstadoReserva.PENDIENTE_CONTACTO, PAST);
    const active = await makeReservation(BASE, EstadoReserva.EN_NEGOCIACION, null, BASE + 1);

    expect(await expireReservations(NOW, deps())).toEqual({ expired: 1, vehiclesReleased: 0 });
    expect(await stateOf(expiring.id)).toBe(EstadoReserva.EXPIRADA);
    expect(await stateOf(active.id)).toBe(EstadoReserva.EN_NEGOCIACION);
    expect(await availabilityOf(BASE)).toBe(Disponibilidad.RESERVADO);
  });

  it.each([Disponibilidad.VENDIDO, Disponibilidad.PROXIMAMENTE])(
    'si el vehículo ya no está RESERVADO (%s), no se modifica',
    async (disponibilidad) => {
      await makeUser(BASE);
      await makeVehicle(BASE, disponibilidad);
      await makeReservation(BASE, EstadoReserva.PENDIENTE_CONTACTO, PAST);

      expect(await expireReservations(NOW, deps())).toEqual({ expired: 1, vehiclesReleased: 0 });
      expect(await availabilityOf(BASE)).toBe(disponibilidad);
    }
  );

  it('varias reservas vencidas del mismo y de distintos vehículos en una sola pasada', async () => {
    await makeUser(BASE);
    await makeUser(BASE + 1);
    await makeVehicle(BASE);
    await makeVehicle(BASE + 1);
    await makeReservation(BASE, EstadoReserva.PENDIENTE_CONTACTO, PAST);
    await makeReservation(BASE, EstadoReserva.PENDIENTE_CONTACTO, PAST, BASE + 1);
    await makeReservation(BASE + 1, EstadoReserva.PENDIENTE_CONTACTO, PAST);

    expect(await expireReservations(NOW, deps())).toEqual({ expired: 3, vehiclesReleased: 2 });
  });
});
