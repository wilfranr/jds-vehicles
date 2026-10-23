import 'server-only';

import { EstadoReserva, type Disponibilidad } from '@prisma/client';
import { prisma } from '@/lib/db';
import { ACTIVE_STATES } from '@/server/reservations/service';

export interface DashboardCounters {
  vehicles: Record<Disponibilidad, number>;
  reservations: { active: number; expiringIn24h: number };
  sales: { monthCount: number; monthTotal: number };
  /** Solo se calcula para `ADMIN`. */
  activeUsers: number | null;
}

const BOGOTA_OFFSET_HOURS = 5; // UTC-5 todo el año (Colombia no usa horario de verano)

/** Inicio del mes calendario de Bogotá que contiene `now`, y el inicio del siguiente (en UTC). */
export function monthBounds(now: Date): { start: Date; end: Date } {
  const local = new Date(now.getTime() - BOGOTA_OFFSET_HOURS * 3_600_000);
  const year = local.getUTCFullYear();
  const month = local.getUTCMonth();
  const shift = BOGOTA_OFFSET_HOURS * 3_600_000;
  return {
    start: new Date(Date.UTC(year, month, 1) + shift),
    end: new Date(Date.UTC(year, month + 1, 1) + shift),
  };
}

/** Contadores reales de la BD para el Resumen. `includeUsers` solo para `ADMIN`. */
export async function getDashboardCounters(
  now: Date,
  options: { includeUsers: boolean }
): Promise<DashboardCounters> {
  const { start, end } = monthBounds(now);
  const in24h = new Date(now.getTime() + 24 * 3_600_000);

  const [byAvailability, active, expiring, sales, users] = await Promise.all([
    prisma.vehiculo.groupBy({ by: ['disponibilidad'], _count: { _all: true } }),
    prisma.reserva.count({ where: { estado: { in: ACTIVE_STATES } } }),
    prisma.reserva.count({
      where: {
        estado: EstadoReserva.PENDIENTE_CONTACTO,
        fechaExpiracion: { gte: now, lte: in24h },
      },
    }),
    prisma.venta.aggregate({
      where: { fechaVenta: { gte: start, lt: end } },
      _count: { _all: true },
      _sum: { precioFinal: true },
    }),
    options.includeUsers ? prisma.user.count({ where: { activo: true } }) : Promise.resolve(null),
  ]);

  const vehicles: Record<Disponibilidad, number> = {
    DISPONIBLE: 0,
    RESERVADO: 0,
    PROXIMAMENTE: 0,
    VENDIDO: 0,
  };
  for (const row of byAvailability) vehicles[row.disponibilidad] = row._count._all;

  return {
    vehicles,
    reservations: { active, expiringIn24h: expiring },
    sales: { monthCount: sales._count._all, monthTotal: Number(sales._sum.precioFinal ?? 0) },
    activeUsers: users,
  };
}
