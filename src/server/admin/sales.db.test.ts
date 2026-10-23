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
import type { SaleInput } from '@/lib/validation/sale';
import { parseDayRange } from './day-range';
import { bogotaYear, getSale, listSales, registerSale } from './sales';

// BD sembrada; filas temporales con ids 9901+ de usuario/vehículo. Las ventas de la prueba llevan fecha de 2031
// (parámetro `now` del servicio) para no mezclarse con datos reales ni con otras pruebas; se borran siempre.
const BASE = 9901;
const NOW = () => new Date('2031-06-15T15:00:00Z');
const createdUsers = new Set<number>();
const createdVehicles = new Set<number>();
let dbUp = false;
try {
  await prisma.$queryRaw`SELECT 1`;
  dbUp = true;
} catch {
  if (process.env.CI) throw new Error('Las pruebas del panel necesitan la BD en CI.');
}

const sale = (overrides: Partial<SaleInput> = {}): SaleInput => ({
  precio: '90000000.00',
  metodoPago: 'TRANSFERENCIA',
  observaciones: undefined,
  confirmar: 'on',
  ...overrides,
});

async function makeUser(id: number) {
  createdUsers.add(id);
  await prisma.user.create({
    data: {
      id,
      rolId: 1,
      nombre: 'Prueba',
      apellido: `Ventas${id}`,
      tipoDocumento: TipoDocumento.CC,
      documentoIdentidad: `TMV${id}`,
      email: `tmp-ventas-${id}@example.com`,
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
      precio: 100000000,
      disponibilidad,
      visibleCatalogo: true,
    },
  });
}

async function makeReservation(
  code: string,
  vehicleId: number,
  userId: number,
  estado: EstadoReserva = EstadoReserva.EN_NEGOCIACION
) {
  await prisma.reserva.create({
    data: { codigoReserva: code, vehiculoId: vehicleId, usuarioId: userId, estado },
  });
}

async function cleanup() {
  const vehicleIds = [...createdVehicles];
  const userIds = [...createdUsers];
  await prisma.venta.deleteMany({
    where: { OR: [{ vehiculoId: { in: vehicleIds } }, { compradorId: { in: userIds } }] },
  });
  await prisma.reserva.deleteMany({
    where: { OR: [{ vehiculoId: { in: vehicleIds } }, { usuarioId: { in: userIds } }] },
  });
  await prisma.vehiculo.deleteMany({ where: { id: { in: vehicleIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  createdVehicles.clear();
  createdUsers.clear();
}

const stateOf = async (code: string) =>
  (await prisma.reserva.findUniqueOrThrow({ where: { codigoReserva: code } })).estado;
const vehicleOf = (id: number) => prisma.vehiculo.findUniqueOrThrow({ where: { id } });

describe('bogotaYear', () => {
  it('usa el año calendario de Bogotá', () => {
    expect(bogotaYear(new Date('2026-12-31T23:00:00-05:00'))).toBe(2026);
    expect(bogotaYear(new Date('2027-01-01T04:59:59Z'))).toBe(2026);
    expect(bogotaYear(new Date('2027-01-01T05:00:00Z'))).toBe(2027);
  });
});

describe.skipIf(!dbUp)('registro de ventas (BD)', () => {
  afterEach(cleanup);
  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it('registra la venta completa: reserva COMPLETADA, vehículo VENDIDO y oculto, comprador y vendedor de servidor', async () => {
    await makeUser(BASE); // comprador (usuario de la reserva)
    await makeUser(BASE + 1); // vendedor (sesión)
    await makeVehicle(BASE);
    await makeReservation('RES-2026-VA22', BASE, BASE);

    const result = await registerSale(
      {
        reservationCode: 'RES-2026-VA22',
        sellerId: BASE + 1,
        sale: sale({ observaciones: 'Entrega el lunes' }),
      },
      NOW
    );

    expect(result).toMatchObject({ status: 'ok', receipt: 'VTA-2031-000001' });
    expect(await stateOf('RES-2026-VA22')).toBe('COMPLETADA');
    expect(await vehicleOf(BASE)).toMatchObject({
      disponibilidad: 'VENDIDO',
      visibleCatalogo: false,
    });

    const venta = await prisma.venta.findUniqueOrThrow({
      where: { numeroReciboContrato: 'VTA-2031-000001' },
    });
    expect(venta).toMatchObject({
      vehiculoId: BASE,
      compradorId: BASE, // el usuario de la reserva
      vendedorUsuarioId: BASE + 1, // el usuario de la sesión
      metodoPago: MetodoPago.TRANSFERENCIA,
      observaciones: 'Entrega el lunes',
    });
    expect(venta.precioFinal.toFixed(2)).toBe('90000000.00');
    expect(venta.reservaId).not.toBeNull();
  });

  it('también se puede registrar desde PENDIENTE_CONTACTO', async () => {
    await makeUser(BASE);
    await makeVehicle(BASE);
    await makeReservation('RES-2026-VB22', BASE, BASE, EstadoReserva.PENDIENTE_CONTACTO);
    expect(
      (await registerSale({ reservationCode: 'RES-2026-VB22', sellerId: BASE, sale: sale() }, NOW))
        .status
    ).toBe('ok');
    expect(await stateOf('RES-2026-VB22')).toBe('COMPLETADA');
  });

  it.each([EstadoReserva.CANCELADA, EstadoReserva.COMPLETADA, EstadoReserva.EXPIRADA])(
    'una reserva %s no admite venta y no cambia nada',
    async (estado) => {
      await makeUser(BASE);
      await makeVehicle(BASE, Disponibilidad.DISPONIBLE);
      await makeReservation('RES-2026-VC22', BASE, BASE, estado);

      expect(
        await registerSale({ reservationCode: 'RES-2026-VC22', sellerId: BASE, sale: sale() }, NOW)
      ).toEqual({
        status: 'invalid_state',
        current: estado,
      });
      expect(await stateOf('RES-2026-VC22')).toBe(estado);
      expect((await vehicleOf(BASE)).disponibilidad).toBe('DISPONIBLE');
      expect(await prisma.venta.count({ where: { vehiculoId: BASE } })).toBe(0);
    }
  );

  it('reversión: si el vehículo no está RESERVADO, la reserva NO queda COMPLETADA y no hay venta', async () => {
    await makeUser(BASE);
    await makeVehicle(BASE, Disponibilidad.DISPONIBLE); // estado inconsistente a propósito
    await makeReservation('RES-2026-VD22', BASE, BASE);

    expect(
      await registerSale({ reservationCode: 'RES-2026-VD22', sellerId: BASE, sale: sale() }, NOW)
    ).toEqual({
      status: 'vehicle_invalid',
    });
    expect(await stateOf('RES-2026-VD22')).toBe('EN_NEGOCIACION'); // revertido
    expect(await vehicleOf(BASE)).toMatchObject({
      disponibilidad: 'DISPONIBLE',
      visibleCatalogo: true,
    });
    expect(await prisma.venta.count({ where: { vehiculoId: BASE } })).toBe(0);
  });

  it('reversión ante un fallo inesperado al crear la venta (vendedor inexistente): nada queda a medias', async () => {
    await makeUser(BASE);
    await makeVehicle(BASE);
    await makeReservation('RES-2026-VE22', BASE, BASE);

    await expect(
      registerSale({ reservationCode: 'RES-2026-VE22', sellerId: 4_000_000_000, sale: sale() }, NOW)
    ).rejects.toThrow();
    expect(await stateOf('RES-2026-VE22')).toBe('EN_NEGOCIACION');
    expect(await vehicleOf(BASE)).toMatchObject({
      disponibilidad: 'RESERVADO',
      visibleCatalogo: true,
    });
    expect(await prisma.venta.count({ where: { vehiculoId: BASE } })).toBe(0);
  });

  it('código inexistente → not_found', async () => {
    expect(
      await registerSale({ reservationCode: 'RES-2026-ZZZZ', sellerId: 1, sale: sale() }, NOW)
    ).toEqual({
      status: 'not_found',
    });
  });

  it('doble envío / carrera: tres registros simultáneos de la misma reserva → UNA venta', async () => {
    await makeUser(BASE);
    await makeVehicle(BASE);
    await makeReservation('RES-2026-VF22', BASE, BASE);

    const results = await Promise.all(
      [1, 2, 3].map(() =>
        registerSale({ reservationCode: 'RES-2026-VF22', sellerId: BASE, sale: sale() }, NOW)
      )
    );

    expect(results.filter((r) => r.status === 'ok')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'invalid_state')).toHaveLength(2);
    expect(await prisma.venta.count({ where: { vehiculoId: BASE } })).toBe(1);
    expect((await vehicleOf(BASE)).disponibilidad).toBe('VENDIDO');
  });

  it('ventas simultáneas de reservas distintas: recibos únicos y consecutivos', async () => {
    const ids = [0, 1, 2, 3].map((n) => BASE + n);
    for (const id of ids) {
      await makeUser(id);
      await makeVehicle(id);
      await makeReservation(`RES-2026-W${'ABCD'[id - BASE]}22`, id, id);
    }

    const results = await Promise.all(
      ids.map((id) =>
        registerSale(
          { reservationCode: `RES-2026-W${'ABCD'[id - BASE]}22`, sellerId: BASE, sale: sale() },
          NOW
        )
      )
    );

    expect(results.every((r) => r.status === 'ok')).toBe(true);
    const receipts = results.map((r) => (r.status === 'ok' ? r.receipt : '')).sort();
    expect(receipts).toEqual([
      'VTA-2031-000001',
      'VTA-2031-000002',
      'VTA-2031-000003',
      'VTA-2031-000004',
    ]);
    expect(new Set(receipts).size).toBe(4);
  });

  it('el consecutivo se reinicia por año y continúa sin colisiones', async () => {
    await makeUser(BASE);
    await makeVehicle(BASE);
    await makeVehicle(BASE + 1);
    await makeReservation('RES-2026-XA22', BASE, BASE);
    await makeReservation('RES-2026-XB22', BASE + 1, BASE);

    const first = await registerSale(
      { reservationCode: 'RES-2026-XA22', sellerId: BASE, sale: sale() },
      NOW
    );
    const nextYear = await registerSale(
      { reservationCode: 'RES-2026-XB22', sellerId: BASE, sale: sale() },
      () => new Date('2032-02-01T15:00:00Z')
    );
    expect(first).toMatchObject({ receipt: 'VTA-2031-000001' });
    expect(nextYear).toMatchObject({ receipt: 'VTA-2032-000001' });
  });

  it('listado: total del periodo con suma decimal exacta y filtro por rango de fechas', async () => {
    await makeUser(BASE);
    for (const [i, price] of [
      [0, '0.10'],
      [1, '0.20'],
      [2, '99.99'],
    ] as const) {
      await makeVehicle(BASE + i);
      await makeReservation(`RES-2026-Y${'ABC'[i]}22`, BASE + i, BASE);
      await registerSale(
        {
          reservationCode: `RES-2026-Y${'ABC'[i]}22`,
          sellerId: BASE,
          sale: sale({ precio: price }),
        },
        NOW
      );
    }

    const june = parseDayRange('2031-06-01', '2031-06-30');
    const all = await listSales({ from: june.from, to: june.to, page: 1 });
    expect(all.total).toBe(3);
    expect(all.totalAmount).toBe('100.29'); // 0.10 + 0.20 + 99.99 (en flotante: 100.28999…)
    expect(all.items.map((s) => s.precio).sort()).toEqual(['0.10', '0.20', '99.99']);
    expect(all.items[0]).toMatchObject({ comprador: `Prueba Ventas${BASE}` });

    const july = parseDayRange('2031-07-01', '2031-07-31');
    expect(await listSales({ from: july.from, to: july.to, page: 1 })).toMatchObject({
      total: 0,
      totalAmount: '0.00',
    });
    // los límites son días completos de Bogotá: la venta del 15 de junio entra en el rango del 15 al 15
    const day = parseDayRange('2031-06-15', '2031-06-15');
    expect((await listSales({ from: day.from, to: day.to, page: 1 })).total).toBe(3);
  });

  it('detalle de una venta por recibo (y null si no existe)', async () => {
    await makeUser(BASE);
    await makeVehicle(BASE);
    await makeReservation('RES-2026-ZA22', BASE, BASE);
    await registerSale(
      { reservationCode: 'RES-2026-ZA22', sellerId: BASE, sale: sale({ metodoPago: 'MIXTO' }) },
      NOW
    );

    expect(await getSale('VTA-2031-000001')).toMatchObject({
      recibo: 'VTA-2031-000001',
      metodo: 'MIXTO',
      reservaCodigo: 'RES-2026-ZA22',
      vehiculoId: BASE,
    });
    expect(await getSale('VTA-2031-000999')).toBeNull();
  });
});
