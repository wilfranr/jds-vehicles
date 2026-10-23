import 'server-only';

import { Prisma, type MetodoPago } from '@prisma/client';
import { prisma } from '@/lib/db';
import { formatReceipt, receiptSequence, type SaleInput } from '@/lib/validation/sale';
import { checkTransition } from '@/server/reservations/transitions';

export const ADMIN_SALES_PAGE_SIZE = 20;
const MAX_RECEIPT_ATTEMPTS = 5;
const MAX_TX_ATTEMPTS = 3;

/** Se lanza dentro de la transacción para revertirla y devolver un resultado de negocio tipado. */
class SaleAbort extends Error {
  constructor(readonly result: Exclude<RegisterSaleResult, { status: 'ok' }>) {
    super('sale-abort');
  }
}

export type RegisterSaleResult =
  | { status: 'ok'; id: number; receipt: string }
  | { status: 'not_found' }
  /** La reserva ya no está en un estado que admita la venta (otra persona la cerró o canceló antes). */
  | { status: 'invalid_state'; current: string }
  | { status: 'vehicle_invalid' };

/** Año calendario de Bogotá (UTC-5) de una fecha. */
export function bogotaYear(date: Date): number {
  return new Date(date.getTime() - 5 * 3_600_000).getUTCFullYear();
}

function isUnique(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

/** Deadlock o conflicto de escritura: la transacción completa puede reintentarse. */
function isRetryable(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  return error.code === 'P2034' || /Deadlock found|code: `1213`/i.test(error.message);
}

/**
 * Exclusión mutua entre ventas: se bloquea una fila fija de `roles` (la última; la de `vehicles.ts` es la primera)
 * que nadie modifica, y se mantiene hasta el `COMMIT`. Es lo PRIMERO que hace la transacción, así el orden de
 * bloqueos es siempre el mismo (mutex → reserva → vehículo) y dos ventas simultáneas no se interbloquean al
 * calcular el consecutivo (un `FOR UPDATE` sobre un rango vacío toma bloqueos de hueco que sí se interbloquean).
 */
async function lockSalesMutex(tx: Prisma.TransactionClient): Promise<void> {
  await tx.$queryRaw`SELECT id FROM roles ORDER BY id DESC LIMIT 1 FOR UPDATE`;
}

/**
 * Siguiente número de recibo del año. La lectura es con bloqueo (`FOR UPDATE`, lectura «actual» de InnoDB): dos
 * ventas simultáneas se turnan y la segunda ve el consecutivo que confirmó la primera. El índice único del
 * recibo es la red de seguridad.
 */
async function nextReceipt(tx: Prisma.TransactionClient, year: number): Promise<string> {
  const rows = await tx.$queryRaw<{ numero: string }[]>`
    SELECT numero_recibo_contrato AS numero FROM ventas
    WHERE numero_recibo_contrato LIKE ${`VTA-${year}-%`}
    ORDER BY numero_recibo_contrato DESC LIMIT 1 FOR UPDATE`;
  const last = rows[0] ? receiptSequence(rows[0].numero, year) : null;
  return formatReceipt(year, (last ?? 0) + 1);
}

/**
 * Registra una venta en UNA transacción: reserva → `COMPLETADA`, vehículo → `VENDIDO` y fuera del catálogo, y la
 * fila en `ventas`. El comprador es el usuario de la reserva y el vendedor es `sellerId` (sesión): ninguno viene
 * del formulario. La fila de la reserva se bloquea y cada cambio se condiciona al estado leído, así que un doble
 * envío o dos personas a la vez producen UNA venta y la otra recibe `invalid_state`. Si cualquier paso falla, se
 * revierte todo.
 */
export async function registerSale(
  input: { reservationCode: string; sellerId: number; sale: SaleInput },
  now: () => Date = () => new Date()
): Promise<RegisterSaleResult> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx): Promise<RegisterSaleResult> => {
          await lockSalesMutex(tx);
          const locked = await tx.$queryRaw<{ id: number }[]>`
            SELECT id FROM reservas WHERE codigo_reserva = ${input.reservationCode} FOR UPDATE`;
          if (locked.length === 0) return { status: 'not_found' };

          const reservation = await tx.reserva.findUniqueOrThrow({
            where: { id: Number(locked[0]!.id) },
            select: { id: true, estado: true, vehiculoId: true, usuarioId: true },
          });
          if (!checkTransition(reservation.estado, 'COMPLETADA', { viaSale: true }).ok) {
            return { status: 'invalid_state', current: reservation.estado };
          }

          const reserved = await tx.reserva.updateMany({
            where: { id: reservation.id, estado: reservation.estado },
            data: { estado: 'COMPLETADA' },
          });
          if (reserved.count !== 1) {
            throw new SaleAbort({ status: 'invalid_state', current: reservation.estado });
          }

          const sold = await tx.vehiculo.updateMany({
            where: { id: reservation.vehiculoId, disponibilidad: 'RESERVADO' },
            data: { disponibilidad: 'VENDIDO', visibleCatalogo: false },
          });
          if (sold.count !== 1) throw new SaleAbort({ status: 'vehicle_invalid' });

          const at = now();
          for (let receiptTry = 1; ; receiptTry++) {
            const receipt = await nextReceipt(tx, bogotaYear(at));
            try {
              const sale = await tx.venta.create({
                data: {
                  numeroReciboContrato: receipt,
                  vehiculoId: reservation.vehiculoId,
                  reservaId: reservation.id,
                  compradorId: reservation.usuarioId,
                  vendedorUsuarioId: input.sellerId,
                  precioFinal: input.sale.precio,
                  metodoPago: input.sale.metodoPago as MetodoPago,
                  fechaVenta: at,
                  observaciones: input.sale.observaciones ?? null,
                },
                select: { id: true },
              });
              return { status: 'ok', id: sale.id, receipt };
            } catch (error) {
              // En MySQL un duplicado no aborta la transacción: se reintenta con el consecutivo siguiente.
              if (isUnique(error) && receiptTry < MAX_RECEIPT_ATTEMPTS) continue;
              if (isUnique(error)) throw new SaleAbort({ status: 'vehicle_invalid' });
              throw error;
            }
          }
        },
        { maxWait: 5000, timeout: 15000 }
      );
    } catch (error) {
      if (error instanceof SaleAbort) return error.result;
      if (isRetryable(error) && attempt < MAX_TX_ATTEMPTS) continue;
      throw error;
    }
  }
}

export interface SaleRow {
  id: number;
  recibo: string;
  fecha: Date;
  vehiculo: string;
  comprador: string;
  vendedor: string | null;
  precio: string;
  metodo: MetodoPago;
}

export async function listSales(filters: {
  from?: Date | null;
  to?: Date | null;
  page: number;
}): Promise<{
  items: SaleRow[];
  total: number;
  page: number;
  pageCount: number;
  /** Suma exacta (decimal) del precio final de TODO el periodo filtrado, con dos decimales. */
  totalAmount: string;
}> {
  const where: Prisma.VentaWhereInput = {
    ...(filters.from || filters.to
      ? {
          fechaVenta: {
            ...(filters.from ? { gte: filters.from } : {}),
            // `to` es el inicio del día siguiente al último día incluido (exclusivo)
            ...(filters.to ? { lt: filters.to } : {}),
          },
        }
      : {}),
  };
  const [total, aggregate] = await Promise.all([
    prisma.venta.count({ where }),
    prisma.venta.aggregate({ where, _sum: { precioFinal: true } }),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / ADMIN_SALES_PAGE_SIZE));
  const page = Math.min(Math.max(1, Math.floor(filters.page) || 1), pageCount);

  const rows = await prisma.venta.findMany({
    where,
    orderBy: [{ fechaVenta: 'desc' }, { id: 'desc' }],
    skip: (page - 1) * ADMIN_SALES_PAGE_SIZE,
    take: ADMIN_SALES_PAGE_SIZE,
    select: saleSelect,
  });
  return {
    items: rows.map(toRow),
    total,
    page,
    pageCount,
    totalAmount: (aggregate._sum.precioFinal ?? new Prisma.Decimal(0)).toFixed(2),
  };
}

const saleSelect = {
  id: true,
  numeroReciboContrato: true,
  fechaVenta: true,
  precioFinal: true,
  metodoPago: true,
  observaciones: true,
  vehiculo: {
    select: {
      id: true,
      anio: true,
      modelo: { select: { nombre: true, marca: { select: { nombre: true } } } },
    },
  },
  comprador: { select: { nombre: true, apellido: true } },
  vendedor: { select: { nombre: true, apellido: true } },
  reserva: { select: { codigoReserva: true } },
} satisfies Prisma.VentaSelect;

type SaleRecord = Prisma.VentaGetPayload<{ select: typeof saleSelect }>;

function toRow(r: SaleRecord): SaleRow {
  return {
    id: r.id,
    recibo: r.numeroReciboContrato,
    fecha: r.fechaVenta,
    vehiculo: `${r.vehiculo.modelo.marca.nombre} ${r.vehiculo.modelo.nombre} ${r.vehiculo.anio}`,
    comprador: `${r.comprador.nombre} ${r.comprador.apellido}`.trim(),
    vendedor: r.vendedor ? `${r.vendedor.nombre} ${r.vendedor.apellido}`.trim() : null,
    precio: r.precioFinal.toFixed(2),
    metodo: r.metodoPago,
  };
}

export interface SaleDetail extends SaleRow {
  observaciones: string | null;
  reservaCodigo: string | null;
  vehiculoId: number;
}

export async function getSale(receipt: string): Promise<SaleDetail | null> {
  const r = await prisma.venta.findUnique({
    where: { numeroReciboContrato: receipt },
    select: saleSelect,
  });
  if (!r) return null;
  return {
    ...toRow(r),
    observaciones: r.observaciones,
    reservaCodigo: r.reserva?.codigoReserva ?? null,
    vehiculoId: r.vehiculo.id,
  };
}
