import 'server-only';

import type { EstadoReserva, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';

export const RESERVATIONS_PAGE_SIZE = 20;

export interface ReservationVehicle {
  id: number;
  marca: string;
  modelo: string;
  anio: number;
  color: string;
  fotoUrl: string | null;
}

export interface ReservationSummary {
  id: number;
  codigo: string;
  estado: EstadoReserva;
  fechaReserva: Date;
  fechaExpiracion: Date | null;
  vehiculo: ReservationVehicle;
}

const vehicleSelect = {
  id: true,
  anio: true,
  color: true,
  modelo: { select: { nombre: true, marca: { select: { nombre: true } } } },
  fotos: {
    orderBy: [{ esPrincipal: 'desc' }, { ordenPresentacion: 'asc' }],
    take: 1,
    select: { urlFoto: true },
  },
} satisfies Prisma.VehiculoSelect;

const reservationSelect = {
  id: true,
  codigoReserva: true,
  estado: true,
  fechaReserva: true,
  fechaExpiracion: true,
  vehiculo: { select: vehicleSelect },
} satisfies Prisma.ReservaSelect;

function toSummary(row: {
  id: number;
  codigoReserva: string;
  estado: EstadoReserva;
  fechaReserva: Date;
  fechaExpiracion: Date | null;
  vehiculo: {
    id: number;
    anio: number;
    color: string;
    modelo: { nombre: string; marca: { nombre: string } };
    fotos: { urlFoto: string }[];
  };
}): ReservationSummary {
  return {
    id: row.id,
    codigo: row.codigoReserva,
    estado: row.estado,
    fechaReserva: row.fechaReserva,
    fechaExpiracion: row.fechaExpiracion,
    vehiculo: {
      id: row.vehiculo.id,
      marca: row.vehiculo.modelo.marca.nombre,
      modelo: row.vehiculo.modelo.nombre,
      anio: row.vehiculo.anio,
      color: row.vehiculo.color,
      fotoUrl: row.vehiculo.fotos[0]?.urlFoto ?? null,
    },
  };
}

/**
 * Reservas del usuario indicado (el id sale SIEMPRE de la sesión), las más recientes primero.
 * Nunca devuelve placa ni datos de otros usuarios.
 */
export async function listUserReservations(
  userId: number,
  page = 1
): Promise<{ items: ReservationSummary[]; total: number; page: number; pageCount: number }> {
  const where = { usuarioId: userId };
  const total = await prisma.reserva.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / RESERVATIONS_PAGE_SIZE));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), pageCount);

  const rows = await prisma.reserva.findMany({
    where,
    orderBy: [{ fechaReserva: 'desc' }, { id: 'desc' }],
    skip: (current - 1) * RESERVATIONS_PAGE_SIZE,
    take: RESERVATIONS_PAGE_SIZE,
    select: reservationSelect,
  });
  return { items: rows.map(toSummary), total, page: current, pageCount };
}

/**
 * Una reserva por código **solo si pertenece al usuario**: un código ajeno devuelve `null`, igual que uno
 * inexistente, para no revelar que existe (la página responde 404 en ambos casos).
 */
export async function getUserReservationByCode(
  userId: number,
  code: string
): Promise<ReservationSummary | null> {
  const row = await prisma.reserva.findFirst({
    where: { codigoReserva: code, usuarioId: userId },
    select: reservationSelect,
  });
  return row ? toSummary(row) : null;
}
