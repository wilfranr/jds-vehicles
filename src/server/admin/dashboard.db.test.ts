// @vitest-environment node
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import {
  Condicion,
  Disponibilidad,
  EstadoReserva,
  MetodoPago,
  TipoDocumento,
} from '@prisma/client';
import { prisma } from '@/lib/db';
import { getDashboardCounters, monthBounds } from './dashboard';

describe('monthBounds (mes calendario de Bogotá, UTC-5)', () => {
  it('el mes empieza a las 05:00 UTC del día 1', () => {
    const { start, end } = monthBounds(new Date('2026-10-23T12:00:00Z'));
    expect(start.toISOString()).toBe('2026-10-01T05:00:00.000Z');
    expect(end.toISOString()).toBe('2026-11-01T05:00:00.000Z');
  });

  it('a las 04:59 UTC del 1 de noviembre todavía es octubre en Bogotá', () => {
    expect(monthBounds(new Date('2026-11-01T04:59:59Z')).start.toISOString()).toBe(
      '2026-10-01T05:00:00.000Z'
    );
    expect(monthBounds(new Date('2026-11-01T05:00:00Z')).start.toISOString()).toBe(
      '2026-11-01T05:00:00.000Z'
    );
  });

  it('cambia de año correctamente', () => {
    const { start, end } = monthBounds(new Date('2026-12-15T00:00:00Z'));
    expect(start.toISOString()).toBe('2026-12-01T05:00:00.000Z');
    expect(end.toISOString()).toBe('2027-01-01T05:00:00.000Z');
  });
});

// Contadores contra la BD sembrada: se toma una línea base y se comprueba el cambio exacto que producen filas
// temporales con ids 9501+ (se borran siempre, solo las propias).
const BASE = 9501;
const NOW = new Date('2026-10-23T12:00:00Z');
const createdUsers = new Set<number>();
const createdVehicles = new Set<number>();
let dbUp = false;
try {
  await prisma.$queryRaw`SELECT 1`;
  dbUp = true;
} catch {
  if (process.env.CI) throw new Error('Las pruebas del panel necesitan la BD en CI.');
}

async function makeUser(id: number, activo = true) {
  createdUsers.add(id);
  await prisma.user.create({
    data: {
      id,
      rolId: 1,
      nombre: 'Prueba',
      apellido: 'Panel',
      tipoDocumento: TipoDocumento.CC,
      documentoIdentidad: `TMP${id}`,
      email: `tmp-panel-${id}@example.com`,
      passwordHash: 'x',
      telefono: '573000000000',
      activo,
    },
  });
}

async function makeVehicle(id: number, disponibilidad: Disponibilidad) {
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

async function cleanup() {
  const vehicleIds = [...createdVehicles];
  const userIds = [...createdUsers];
  await prisma.venta.deleteMany({ where: { vehiculoId: { in: vehicleIds } } });
  await prisma.reserva.deleteMany({
    where: { OR: [{ vehiculoId: { in: vehicleIds } }, { usuarioId: { in: userIds } }] },
  });
  await prisma.vehiculo.deleteMany({ where: { id: { in: vehicleIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  createdVehicles.clear();
  createdUsers.clear();
}

describe.skipIf(!dbUp)('getDashboardCounters (BD)', () => {
  afterEach(cleanup);
  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it('los contadores cambian exactamente con las filas temporales', async () => {
    const before = await getDashboardCounters(NOW, { includeUsers: true });

    await makeUser(BASE);
    await makeUser(BASE + 1, false); // inactivo: no cuenta
    await makeVehicle(BASE, Disponibilidad.DISPONIBLE);
    await makeVehicle(BASE + 1, Disponibilidad.RESERVADO);
    await makeVehicle(BASE + 2, Disponibilidad.RESERVADO);
    await makeVehicle(BASE + 3, Disponibilidad.VENDIDO);
    await makeVehicle(BASE + 4, Disponibilidad.PROXIMAMENTE);
    await makeVehicle(BASE + 5, Disponibilidad.RESERVADO);

    const hours = (h: number) => new Date(NOW.getTime() + h * 3_600_000);
    const reserve = (vehiculoId: number, code: string, estado: EstadoReserva, exp: Date | null) =>
      prisma.reserva.create({
        data: { codigoReserva: code, vehiculoId, usuarioId: BASE, estado, fechaExpiracion: exp },
      });
    await reserve(BASE + 1, 'RES-2026-PA22', EstadoReserva.PENDIENTE_CONTACTO, hours(10)); // activa, por vencer
    await reserve(BASE + 2, 'RES-2026-PB22', EstadoReserva.PENDIENTE_CONTACTO, hours(30)); // activa, no por vencer
    await reserve(BASE + 5, 'RES-2026-PC22', EstadoReserva.EN_NEGOCIACION, hours(5)); // activa, no cuenta como por vencer
    await reserve(BASE, 'RES-2026-PD22', EstadoReserva.CANCELADA, hours(5)); // no activa
    await reserve(BASE + 4, 'RES-2026-PE22', EstadoReserva.PENDIENTE_CONTACTO, hours(-2)); // ya vencida: no es «por vencer»

    const sale = (vehiculoId: number, numero: string, fecha: Date, precio: number) =>
      prisma.venta.create({
        data: {
          numeroReciboContrato: numero,
          vehiculoId,
          compradorId: BASE,
          precioFinal: precio,
          metodoPago: MetodoPago.TRANSFERENCIA,
          fechaVenta: fecha,
        },
      });
    await sale(BASE + 3, 'E2E-PANEL-1', new Date('2026-10-05T15:00:00Z'), 90000000); // este mes
    await sale(BASE, 'E2E-PANEL-2', new Date('2026-09-30T20:00:00Z'), 50000000); // mes anterior

    const after = await getDashboardCounters(NOW, { includeUsers: true });

    expect(after.vehicles.DISPONIBLE - before.vehicles.DISPONIBLE).toBe(1);
    expect(after.vehicles.RESERVADO - before.vehicles.RESERVADO).toBe(3);
    expect(after.vehicles.VENDIDO - before.vehicles.VENDIDO).toBe(1);
    expect(after.vehicles.PROXIMAMENTE - before.vehicles.PROXIMAMENTE).toBe(1);
    expect(after.reservations.active - before.reservations.active).toBe(4); // 3 + la vencida pendiente
    expect(after.reservations.expiringIn24h - before.reservations.expiringIn24h).toBe(1);
    expect(after.sales.monthCount - before.sales.monthCount).toBe(1);
    expect(after.sales.monthTotal - before.sales.monthTotal).toBe(90000000);
    expect(after.activeUsers! - before.activeUsers!).toBe(1);
  });

  it('sin includeUsers (ASESOR) no calcula ni devuelve usuarios', async () => {
    expect((await getDashboardCounters(NOW, { includeUsers: false })).activeUsers).toBeNull();
  });
});
