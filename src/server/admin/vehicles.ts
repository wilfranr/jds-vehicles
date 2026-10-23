import 'server-only';

import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import type { VehicleInput } from '@/lib/validation/vehicle';
import { ACTIVE_STATES } from '@/server/reservations/service';
import {
  canChangeVisibility,
  editableData,
  vehicleLock,
  type AdminVehicleDetail,
} from './vehicle-rules';

export const ADMIN_PAGE_SIZE = 20;

export interface AdminVehicleFilters {
  q?: string;
  condicion?: 'NUEVO' | 'USADO';
  disponibilidad?: 'DISPONIBLE' | 'RESERVADO' | 'PROXIMAMENTE' | 'VENDIDO';
  visible?: boolean;
  page: number;
}

export interface AdminVehicleRow {
  id: number;
  marca: string;
  modelo: string;
  anio: number;
  condicion: 'NUEVO' | 'USADO';
  precio: number;
  disponibilidad: 'DISPONIBLE' | 'RESERVADO' | 'PROXIMAMENTE' | 'VENDIDO';
  visible: boolean;
  hasActiveReservation: boolean;
}

export async function listAdminVehicles(
  filters: AdminVehicleFilters
): Promise<{ items: AdminVehicleRow[]; total: number; page: number; pageCount: number }> {
  const q = filters.q?.trim();
  const where: Prisma.VehiculoWhereInput = {
    ...(filters.condicion ? { condicion: filters.condicion } : {}),
    ...(filters.disponibilidad ? { disponibilidad: filters.disponibilidad } : {}),
    ...(filters.visible !== undefined ? { visibleCatalogo: filters.visible } : {}),
    ...(q
      ? {
          OR: [
            { modelo: { nombre: { contains: q } } },
            { modelo: { marca: { nombre: { contains: q } } } },
            { color: { contains: q } },
            { placa: { contains: q.replace(/[\s-]/g, '').toUpperCase() } },
          ],
        }
      : {}),
  };

  const total = await prisma.vehiculo.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));
  const page = Math.min(Math.max(1, Math.floor(filters.page) || 1), pageCount);
  const rows = await prisma.vehiculo.findMany({
    where,
    orderBy: [{ id: 'desc' }],
    skip: (page - 1) * ADMIN_PAGE_SIZE,
    take: ADMIN_PAGE_SIZE,
    select: {
      id: true,
      anio: true,
      condicion: true,
      precio: true,
      disponibilidad: true,
      visibleCatalogo: true,
      modelo: { select: { nombre: true, marca: { select: { nombre: true } } } },
      _count: { select: { reservas: { where: { estado: { in: ACTIVE_STATES } } } } },
    },
  });

  return {
    items: rows.map((r) => ({
      id: r.id,
      marca: r.modelo.marca.nombre,
      modelo: r.modelo.nombre,
      anio: r.anio,
      condicion: r.condicion,
      precio: Number(r.precio),
      disponibilidad: r.disponibilidad,
      visible: r.visibleCatalogo,
      hasActiveReservation: r._count.reservas > 0,
    })),
    total,
    page,
    pageCount,
  };
}

export async function getAdminVehicle(id: number): Promise<AdminVehicleDetail | null> {
  const v = await prisma.vehiculo.findUnique({
    where: { id },
    include: {
      modelo: { include: { marca: true } },
      _count: { select: { reservas: { where: { estado: { in: ACTIVE_STATES } } } } },
    },
  });
  if (!v) return null;
  return {
    id: v.id,
    modeloId: v.modeloId,
    marcaId: v.modelo.marcaId,
    marcaNombre: v.modelo.marca.nombre,
    modeloNombre: v.modelo.nombre,
    anio: v.anio,
    color: v.color,
    condicion: v.condicion,
    placa: v.placa,
    precio: v.precio.toFixed(2),
    kilometraje: v.kilometraje,
    transmision: v.transmision,
    combustible: v.combustible,
    cilindraje: v.cilindraje,
    descripcion: v.descripcion,
    disponibilidad: v.disponibilidad,
    visibleCatalogo: v.visibleCatalogo,
    hasActiveReservation: v._count.reservas > 0,
  };
}

/** Modelos activos (de marcas activas) para los selectores. */
export async function listSelectableModels(includeId?: number) {
  const models = await prisma.modelo.findMany({
    where: {
      OR: [{ activo: true, marca: { activo: true } }, ...(includeId ? [{ id: includeId }] : [])],
    },
    orderBy: [{ marca: { nombre: 'asc' } }, { nombre: 'asc' }],
    select: { id: true, nombre: true, marca: { select: { nombre: true } } },
  });
  return models.map((m) => ({ id: m.id, label: `${m.marca.nombre} ${m.nombre}` }));
}

export type VehicleWriteResult =
  | { status: 'ok'; id: number }
  | { status: 'plate_duplicate' }
  | { status: 'model_invalid' }
  | { status: 'not_found' }
  | { status: 'locked' };

/**
 * La placa debe ser única entre los vehículos no vendidos. No hay restricción única en la BD (un vehículo
 * vendido conserva su placa), así que se comprueba dentro de la transacción. Para que dos altas simultáneas con
 * la misma placa no pasen ambas la comprobación, se serializan con un bloqueo de fila (`FOR UPDATE`) sobre una
 * fila fija de `roles`, que nadie más modifica: el bloqueo se mantiene hasta el `COMMIT` (un bloqueo con nombre
 * de MySQL se liberaría antes de confirmar y no bastaría), y la segunda transacción ya ve la placa de la primera.
 */
async function withPlateLock<T>(tx: Prisma.TransactionClient, fn: () => Promise<T>): Promise<T> {
  await tx.$queryRaw`SELECT id FROM roles ORDER BY id LIMIT 1 FOR UPDATE`;
  return fn();
}

async function plateTaken(tx: Prisma.TransactionClient, plate: string, exceptId?: number) {
  const other = await tx.vehiculo.findFirst({
    where: {
      placa: plate,
      disponibilidad: { not: 'VENDIDO' },
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    select: { id: true },
  });
  return other !== null;
}

async function modelIsUsable(tx: Prisma.TransactionClient, modeloId: number, current?: number) {
  if (current === modeloId) return true; // conservar un modelo ya inactivo no es un error
  const model = await tx.modelo.findUnique({
    where: { id: modeloId },
    select: { activo: true, marca: { select: { activo: true } } },
  });
  return model !== null && model.activo && model.marca.activo;
}

export async function createVehicle(input: VehicleInput): Promise<VehicleWriteResult> {
  return prisma.$transaction(async (tx) =>
    withPlateLock(tx, async (): Promise<VehicleWriteResult> => {
      if (!(await modelIsUsable(tx, input.modeloId))) return { status: 'model_invalid' };
      if (input.placa && (await plateTaken(tx, input.placa))) return { status: 'plate_duplicate' };

      const created = await tx.vehiculo.create({
        data: {
          modeloId: input.modeloId,
          anio: input.anio,
          color: input.color,
          condicion: input.condicion,
          placa: input.placa ?? null,
          precio: input.precio,
          kilometraje: input.kilometraje,
          transmision: input.transmision,
          combustible: input.combustible,
          cilindraje: input.cilindraje ?? null,
          descripcion: input.descripcion ?? null,
          disponibilidad: input.disponibilidad,
          visibleCatalogo: true,
        },
        select: { id: true },
      });
      return { status: 'ok', id: created.id };
    })
  );
}

/**
 * Edita un vehículo. El bloqueo (`none | reserved | sold`) se calcula DENTRO de la transacción con la fila
 * bloqueada (`FOR UPDATE`) para que una reserva simultánea no se cuele entre la lectura y la escritura.
 * `buildInput` recibe el estado actual y devuelve la entrada ya validada (o `null` si no es válida).
 */
export async function updateVehicle(
  id: number,
  buildInput: (current: AdminVehicleDetail) => VehicleInput | null
): Promise<VehicleWriteResult | { status: 'invalid' }> {
  return prisma.$transaction(async (tx) =>
    withPlateLock(tx, async () => {
      await tx.$queryRaw`SELECT id FROM vehiculos WHERE id = ${id} FOR UPDATE`;
      const row = await tx.vehiculo.findUnique({
        where: { id },
        include: {
          modelo: { include: { marca: true } },
          _count: { select: { reservas: { where: { estado: { in: ACTIVE_STATES } } } } },
        },
      });
      if (!row) return { status: 'not_found' as const };

      const current: AdminVehicleDetail = {
        id: row.id,
        modeloId: row.modeloId,
        marcaId: row.modelo.marcaId,
        marcaNombre: row.modelo.marca.nombre,
        modeloNombre: row.modelo.nombre,
        anio: row.anio,
        color: row.color,
        condicion: row.condicion,
        placa: row.placa,
        precio: row.precio.toFixed(2),
        kilometraje: row.kilometraje,
        transmision: row.transmision,
        combustible: row.combustible,
        cilindraje: row.cilindraje,
        descripcion: row.descripcion,
        disponibilidad: row.disponibilidad,
        visibleCatalogo: row.visibleCatalogo,
        hasActiveReservation: row._count.reservas > 0,
      };
      const lock = vehicleLock(current);
      if (lock === 'sold') return { status: 'locked' as const };

      const input = buildInput(current);
      if (!input) return { status: 'invalid' as const };
      const data = editableData(lock, input);
      if (!data) return { status: 'locked' as const };

      if (lock === 'none') {
        if (!(await modelIsUsable(tx, input.modeloId, current.modeloId))) {
          return { status: 'model_invalid' as const };
        }
        if (input.placa && (await plateTaken(tx, input.placa, id))) {
          return { status: 'plate_duplicate' as const };
        }
      }
      await tx.vehiculo.update({ where: { id }, data });
      return { status: 'ok' as const, id };
    })
  );
}

/** Mostrar u ocultar del catálogo. Reglas en `canChangeVisibility`. */
export async function setVehicleVisibility(
  id: number,
  visible: boolean
): Promise<{ status: 'ok' } | { status: 'not_found' } | { status: 'locked' }> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM vehiculos WHERE id = ${id} FOR UPDATE`;
    const row = await tx.vehiculo.findUnique({
      where: { id },
      select: {
        disponibilidad: true,
        _count: { select: { reservas: { where: { estado: { in: ACTIVE_STATES } } } } },
      },
    });
    if (!row) return { status: 'not_found' as const };
    const lock = vehicleLock({
      disponibilidad: row.disponibilidad,
      hasActiveReservation: row._count.reservas > 0,
    });
    if (!canChangeVisibility(lock, visible)) return { status: 'locked' as const };
    await tx.vehiculo.update({ where: { id }, data: { visibleCatalogo: visible } });
    return { status: 'ok' as const };
  });
}
