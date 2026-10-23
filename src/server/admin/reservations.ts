import 'server-only';

import type { EstadoReserva, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { ACTIVE_STATES } from '@/server/reservations/service';
import { checkTransition } from '@/server/reservations/transitions';

export const ADMIN_RESERVATIONS_PAGE_SIZE = 20;

export interface AdminReservationFilters {
  q?: string;
  estado?: EstadoReserva;
  page: number;
}

export interface AdminReservationRow {
  id: number;
  codigo: string;
  estado: EstadoReserva;
  fechaReserva: Date;
  fechaExpiracion: Date | null;
  cliente: string;
  vehiculo: string;
}

/** `*******890`: del documento solo se muestran los 3 últimos caracteres. */
export function maskDocument(document: string): string {
  if (document.length <= 3) return '*'.repeat(document.length);
  return `${'*'.repeat(document.length - 3)}${document.slice(-3)}`;
}

/**
 * Lista las reservas con las activas primero (después, las más recientes). La búsqueda es parametrizada
 * (Prisma, sin SQL crudo): por código si el texto empieza por `RES-`, y por correo en caso contrario.
 */
export async function listAdminReservations(filters: AdminReservationFilters): Promise<{
  items: AdminReservationRow[];
  total: number;
  page: number;
  pageCount: number;
}> {
  const q = filters.q?.trim();
  const where: Prisma.ReservaWhereInput = {
    ...(filters.estado ? { estado: filters.estado } : {}),
    ...(q
      ? /^res-/i.test(q)
        ? { codigoReserva: { contains: q.toUpperCase() } }
        : { usuario: { email: { contains: q.toLowerCase() } } }
      : {}),
  };

  // «Activas primero»: se pagina primero el tramo de activas y luego el de las demás, cada uno con su
  // propia consulta (sin traer todas las filas a memoria).
  const activeWhere: Prisma.ReservaWhereInput = { AND: [where, { estado: { in: ACTIVE_STATES } }] };
  const otherWhere: Prisma.ReservaWhereInput = {
    AND: [where, { estado: { notIn: ACTIVE_STATES } }],
  };
  const [activeCount, otherCount] = await Promise.all([
    prisma.reserva.count({ where: activeWhere }),
    prisma.reserva.count({ where: otherWhere }),
  ]);
  const total = activeCount + otherCount;
  const pageCount = Math.max(1, Math.ceil(total / ADMIN_RESERVATIONS_PAGE_SIZE));
  const page = Math.min(Math.max(1, Math.floor(filters.page) || 1), pageCount);
  const start = (page - 1) * ADMIN_RESERVATIONS_PAGE_SIZE;

  const select = {
    id: true,
    codigoReserva: true,
    estado: true,
    fechaReserva: true,
    fechaExpiracion: true,
    usuario: { select: { nombre: true, apellido: true } },
    vehiculo: {
      select: {
        anio: true,
        modelo: { select: { nombre: true, marca: { select: { nombre: true } } } },
      },
    },
  } satisfies Prisma.ReservaSelect;
  const orderBy: Prisma.ReservaOrderByWithRelationInput[] = [
    { fechaReserva: 'desc' },
    { id: 'desc' },
  ];

  const rows = [];
  if (start < activeCount) {
    rows.push(
      ...(await prisma.reserva.findMany({
        where: activeWhere,
        orderBy,
        select,
        skip: start,
        take: Math.min(ADMIN_RESERVATIONS_PAGE_SIZE, activeCount - start),
      }))
    );
  }
  const missing = ADMIN_RESERVATIONS_PAGE_SIZE - rows.length;
  if (missing > 0 && start + rows.length < total) {
    rows.push(
      ...(await prisma.reserva.findMany({
        where: otherWhere,
        orderBy,
        select,
        skip: Math.max(0, start - activeCount),
        take: missing,
      }))
    );
  }

  const items = rows.map((r) => ({
    id: r.id,
    codigo: r.codigoReserva,
    estado: r.estado,
    fechaReserva: r.fechaReserva,
    fechaExpiracion: r.fechaExpiracion,
    cliente: `${r.usuario.nombre} ${r.usuario.apellido}`.trim(),
    vehiculo: `${r.vehiculo.modelo.marca.nombre} ${r.vehiculo.modelo.nombre} ${r.vehiculo.anio}`,
  }));
  return { items, total, page, pageCount };
}

export interface AdminReservationDetail {
  id: number;
  codigo: string;
  estado: EstadoReserva;
  fechaReserva: Date;
  fechaExpiracion: Date | null;
  observaciones: string | null;
  cliente: {
    nombre: string;
    apellido: string;
    telefono: string;
    email: string;
    ciudad: string | null;
    documentoEnmascarado: string;
  };
  vehiculo: {
    id: number;
    marca: string;
    modelo: string;
    anio: number;
    color: string;
    placa: string | null;
    precio: number;
  };
}

/** Detalle para el personal: nunca incluye el hash de la contraseña y el documento va enmascarado. */
export async function getAdminReservation(codigo: string): Promise<AdminReservationDetail | null> {
  const r = await prisma.reserva.findUnique({
    where: { codigoReserva: codigo },
    select: {
      id: true,
      codigoReserva: true,
      estado: true,
      fechaReserva: true,
      fechaExpiracion: true,
      observaciones: true,
      usuario: {
        select: {
          nombre: true,
          apellido: true,
          telefono: true,
          email: true,
          ciudad: true,
          documentoIdentidad: true,
        },
      },
      vehiculo: {
        select: {
          id: true,
          anio: true,
          color: true,
          placa: true,
          precio: true,
          modelo: { select: { nombre: true, marca: { select: { nombre: true } } } },
        },
      },
    },
  });
  if (!r) return null;
  return {
    id: r.id,
    codigo: r.codigoReserva,
    estado: r.estado,
    fechaReserva: r.fechaReserva,
    fechaExpiracion: r.fechaExpiracion,
    observaciones: r.observaciones,
    cliente: {
      nombre: r.usuario.nombre,
      apellido: r.usuario.apellido,
      telefono: r.usuario.telefono,
      email: r.usuario.email,
      ciudad: r.usuario.ciudad,
      documentoEnmascarado: maskDocument(r.usuario.documentoIdentidad),
    },
    vehiculo: {
      id: r.vehiculo.id,
      marca: r.vehiculo.modelo.marca.nombre,
      modelo: r.vehiculo.modelo.nombre,
      anio: r.vehiculo.anio,
      color: r.vehiculo.color,
      placa: r.vehiculo.placa,
      precio: Number(r.vehiculo.precio),
    },
  };
}

export type StaffTransitionResult =
  | { status: 'ok'; id: number; vehicleReleased: boolean }
  | { status: 'not_found' }
  /** La reserva ya no admite la acción (otra persona la cambió antes, o es un estado final). */
  | { status: 'invalid_transition'; current: EstadoReserva };

/**
 * Cambia el estado de una reserva en UNA transacción. La fila se bloquea (`FOR UPDATE`): dos personas del
 * personal actuando a la vez quedan en fila y la segunda ve el estado ya cambiado (`invalid_transition`), sin
 * error 500. El `updateMany` además exige el estado leído. Al cancelar, el vehículo vuelve a `DISPONIBLE` solo
 * si sigue `RESERVADO` y no tiene otra reserva activa. `reason` se añade a las observaciones.
 */
export async function changeReservationState(
  codigo: string,
  to: Extract<EstadoReserva, 'EN_NEGOCIACION' | 'CANCELADA'>,
  reason?: string
): Promise<StaffTransitionResult> {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ id: number }[]>`
      SELECT id FROM reservas WHERE codigo_reserva = ${codigo} FOR UPDATE`;
    if (locked.length === 0) return { status: 'not_found' as const };

    const row = await tx.reserva.findUniqueOrThrow({
      where: { id: Number(locked[0]!.id) },
      select: { id: true, estado: true, vehiculoId: true, observaciones: true },
    });
    if (!checkTransition(row.estado, to).ok) {
      return { status: 'invalid_transition' as const, current: row.estado };
    }

    const notes =
      to === 'CANCELADA' && reason
        ? [row.observaciones, `Cancelación: ${reason}`].filter(Boolean).join('\n').slice(0, 1000)
        : undefined;
    const updated = await tx.reserva.updateMany({
      where: { id: row.id, estado: row.estado },
      data: { estado: to, ...(notes !== undefined ? { observaciones: notes } : {}) },
    });
    if (updated.count !== 1) return { status: 'invalid_transition' as const, current: row.estado };

    let vehicleReleased = false;
    if (to === 'CANCELADA') {
      const released = await tx.vehiculo.updateMany({
        where: {
          id: row.vehiculoId,
          disponibilidad: 'RESERVADO',
          reservas: { none: { estado: { in: ACTIVE_STATES } } },
        },
        data: { disponibilidad: 'DISPONIBLE' },
      });
      vehicleReleased = released.count === 1;
    }
    return { status: 'ok' as const, id: row.id, vehicleReleased };
  });
}

/** Guarda las observaciones (vacío las borra). */
export async function saveReservationNotes(
  codigo: string,
  notes: string
): Promise<{ status: 'ok'; id: number } | { status: 'not_found' }> {
  const reservation = await prisma.reserva.findUnique({
    where: { codigoReserva: codigo },
    select: { id: true },
  });
  if (!reservation) return { status: 'not_found' };
  await prisma.reserva.update({
    where: { id: reservation.id },
    data: { observaciones: notes === '' ? null : notes },
  });
  return { status: 'ok', id: reservation.id };
}
