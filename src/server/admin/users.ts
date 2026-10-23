import 'server-only';

import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { ACTIVE_STATES } from '@/server/reservations/service';
import { maskDocument } from './mask';

export const ADMIN_USERS_PAGE_SIZE = 20;

export type RoleName = 'CLIENTE' | 'ASESOR' | 'ADMIN';
export const ROLE_NAMES: readonly RoleName[] = ['CLIENTE', 'ASESOR', 'ADMIN'];

export interface AdminUserRow {
  id: number;
  nombre: string;
  email: string;
  rol: RoleName;
  activo: boolean;
  createdAt: Date;
  documentoEnmascarado: string;
  activeReservations: number;
}

/** Listado paginado con búsqueda parametrizada por nombre o correo (Prisma, sin SQL crudo). Nunca incluye el hash. */
export async function listAdminUsers(filters: { q?: string; page: number }): Promise<{
  items: AdminUserRow[];
  total: number;
  page: number;
  pageCount: number;
}> {
  const q = filters.q?.trim();
  const where: Prisma.UserWhereInput = q
    ? {
        OR: [
          { email: { contains: q.toLowerCase() } },
          { nombre: { contains: q } },
          { apellido: { contains: q } },
        ],
      }
    : {};
  const total = await prisma.user.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / ADMIN_USERS_PAGE_SIZE));
  const page = Math.min(Math.max(1, Math.floor(filters.page) || 1), pageCount);

  const rows = await prisma.user.findMany({
    where,
    orderBy: [{ id: 'asc' }],
    skip: (page - 1) * ADMIN_USERS_PAGE_SIZE,
    take: ADMIN_USERS_PAGE_SIZE,
    select: {
      id: true,
      nombre: true,
      apellido: true,
      email: true,
      activo: true,
      createdAt: true,
      documentoIdentidad: true,
      rol: { select: { nombre: true } },
      _count: { select: { reservas: { where: { estado: { in: ACTIVE_STATES } } } } },
    },
  });
  return {
    items: rows.map((u) => ({
      id: u.id,
      nombre: `${u.nombre} ${u.apellido}`.trim(),
      email: u.email,
      rol: u.rol.nombre as RoleName,
      activo: u.activo,
      createdAt: u.createdAt,
      documentoEnmascarado: maskDocument(u.documentoIdentidad),
      activeReservations: u._count.reservas,
    })),
    total,
    page,
    pageCount,
  };
}

export type UserChangeResult =
  | { status: 'ok'; id: number; activeReservations: number }
  | { status: 'not_found' }
  | { status: 'self_forbidden' }
  | { status: 'last_admin' };

/**
 * Bloquea (en orden de id, para evitar bloqueos mutuos) todas las filas de administradores y la del usuario
 * objetivo con UNA sola sentencia `FOR UPDATE`. Así, dos administradores que a la vez se desactivan o degradan
 * mutuamente quedan en fila y el segundo ve ya el cambio del primero.
 */
async function lockAdminsAndTarget(tx: Prisma.TransactionClient, targetId: number): Promise<void> {
  await tx.$queryRaw`
    SELECT u.id FROM usuarios u JOIN roles r ON r.id = u.rol_id
    WHERE r.nombre = 'ADMIN' OR u.id = ${targetId}
    ORDER BY u.id FOR UPDATE`;
}

async function activeAdminCount(tx: Prisma.TransactionClient): Promise<number> {
  return tx.user.count({ where: { activo: true, rol: { nombre: 'ADMIN' } } });
}

async function loadTarget(tx: Prisma.TransactionClient, id: number) {
  return tx.user.findUnique({
    where: { id },
    select: {
      id: true,
      activo: true,
      rol: { select: { nombre: true } },
      _count: { select: { reservas: { where: { estado: { in: ACTIVE_STATES } } } } },
    },
  });
}

/** Activa o desactiva una cuenta. No permite auto-desactivarse ni dejar al sistema sin un ADMIN activo. */
export async function setUserActive(
  actorId: number,
  targetId: number,
  activo: boolean
): Promise<UserChangeResult> {
  return prisma.$transaction(async (tx) => {
    await lockAdminsAndTarget(tx, targetId);
    const target = await loadTarget(tx, targetId);
    if (!target) return { status: 'not_found' as const };
    if (!activo) {
      if (target.id === actorId) return { status: 'self_forbidden' as const };
      if (target.rol.nombre === 'ADMIN' && target.activo && (await activeAdminCount(tx)) <= 1) {
        return { status: 'last_admin' as const };
      }
    }
    await tx.user.update({ where: { id: targetId }, data: { activo } });
    return { status: 'ok' as const, id: targetId, activeReservations: target._count.reservas };
  });
}

/** Cambia el rol. No permite que un administrador se quite su propio rol ni dejar al sistema sin ADMIN activo. */
export async function setUserRole(
  actorId: number,
  targetId: number,
  rol: RoleName
): Promise<UserChangeResult> {
  return prisma.$transaction(async (tx) => {
    await lockAdminsAndTarget(tx, targetId);
    const target = await loadTarget(tx, targetId);
    if (!target) return { status: 'not_found' as const };

    const losesAdmin = target.rol.nombre === 'ADMIN' && rol !== 'ADMIN';
    if (losesAdmin) {
      if (target.id === actorId) return { status: 'self_forbidden' as const };
      if (target.activo && (await activeAdminCount(tx)) <= 1) {
        return { status: 'last_admin' as const };
      }
    }
    const role = await tx.role.findUnique({ where: { nombre: rol }, select: { id: true } });
    if (!role) return { status: 'not_found' as const };
    await tx.user.update({ where: { id: targetId }, data: { rolId: role.id } });
    return { status: 'ok' as const, id: targetId, activeReservations: target._count.reservas };
  });
}

/** Guarda el hash de una contraseña temporal. No permite que un administrador restablezca la suya (usa «Mi cuenta»). */
export async function setUserPasswordHash(
  actorId: number,
  targetId: number,
  passwordHash: string
): Promise<{ status: 'ok'; id: number } | { status: 'not_found' } | { status: 'self_forbidden' }> {
  if (targetId === actorId) return { status: 'self_forbidden' };
  try {
    await prisma.user.update({ where: { id: targetId }, data: { passwordHash } });
    return { status: 'ok', id: targetId };
  } catch (error) {
    if ((error as { code?: string }).code === 'P2025') return { status: 'not_found' };
    throw error;
  }
}
