import 'server-only';

import { prisma } from '@/lib/db';
import { MAX_PHOTOS_PER_VEHICLE } from '@/server/media/limits';

export interface AdminPhoto {
  id: number;
  url: string;
  esPrincipal: boolean;
  orden: number;
}

/** Fotos de un vehículo en el orden de presentación (la principal primero). */
export async function listVehiclePhotos(vehicleId: number): Promise<AdminPhoto[]> {
  const rows = await prisma.vehiculoFoto.findMany({
    where: { vehiculoId: vehicleId },
    orderBy: [{ ordenPresentacion: 'asc' }, { id: 'asc' }],
    select: { id: true, urlFoto: true, esPrincipal: true, ordenPresentacion: true },
  });
  return rows.map((r) => ({
    id: r.id,
    url: r.urlFoto,
    esPrincipal: r.esPrincipal,
    orden: r.ordenPresentacion,
  }));
}

export async function countVehiclePhotos(vehicleId: number): Promise<number | null> {
  const vehicle = await prisma.vehiculo.findUnique({
    where: { id: vehicleId },
    select: { _count: { select: { fotos: true } } },
  });
  return vehicle ? vehicle._count.fotos : null;
}

/** Bloquea la fila del vehículo: serializa los cambios de fotos del mismo vehículo. */
async function lockVehicle(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  id: number
) {
  const rows = await tx.$queryRaw<
    { id: number }[]
  >`SELECT id FROM vehiculos WHERE id = ${id} FOR UPDATE`;
  return rows.length > 0;
}

/** Renumera 1..n respetando el orden actual (para que `orden_presentacion` quede consecutivo). */
async function renumber(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  vehicleId: number
) {
  const photos = await tx.vehiculoFoto.findMany({
    where: { vehiculoId: vehicleId },
    orderBy: [{ ordenPresentacion: 'asc' }, { id: 'asc' }],
    select: { id: true },
  });
  for (const [index, photo] of photos.entries()) {
    await tx.vehiculoFoto.update({
      where: { id: photo.id },
      data: { ordenPresentacion: index + 1 },
    });
  }
  return photos.map((p) => p.id);
}

export type AddPhotosResult =
  { status: 'ok'; ids: number[] } | { status: 'not_found' } | { status: 'limit' };

/**
 * Inserta las fotos al final del orden. La primera foto de un vehículo sin fotos queda como principal
 * (exactamente una principal). Comprueba el tope por vehículo con la fila bloqueada.
 */
export async function addPhotos(vehicleId: number, urls: string[]): Promise<AddPhotosResult> {
  return prisma.$transaction(async (tx) => {
    if (!(await lockVehicle(tx, vehicleId))) return { status: 'not_found' as const };
    const existing = await tx.vehiculoFoto.findMany({
      where: { vehiculoId: vehicleId },
      select: { ordenPresentacion: true, esPrincipal: true },
    });
    if (existing.length + urls.length > MAX_PHOTOS_PER_VEHICLE) return { status: 'limit' as const };

    let order = existing.reduce((max, p) => Math.max(max, p.ordenPresentacion), 0);
    let hasPrincipal = existing.some((p) => p.esPrincipal);
    const ids: number[] = [];
    for (const url of urls) {
      order += 1;
      const created = await tx.vehiculoFoto.create({
        data: {
          vehiculoId: vehicleId,
          urlFoto: url,
          esPrincipal: !hasPrincipal,
          ordenPresentacion: order,
        },
        select: { id: true },
      });
      hasPrincipal = true;
      ids.push(created.id);
    }
    return { status: 'ok' as const, ids };
  });
}

export type PhotoChangeResult = { status: 'ok' } | { status: 'not_found' };

/** Marca una foto como principal y desmarca las demás (siempre exactamente una). */
export async function setPrincipalPhoto(
  vehicleId: number,
  photoId: number
): Promise<PhotoChangeResult> {
  return prisma.$transaction(async (tx) => {
    if (!(await lockVehicle(tx, vehicleId))) return { status: 'not_found' as const };
    const photo = await tx.vehiculoFoto.findFirst({
      where: { id: photoId, vehiculoId: vehicleId },
      select: { id: true },
    });
    if (!photo) return { status: 'not_found' as const };
    await tx.vehiculoFoto.updateMany({
      where: { vehiculoId: vehicleId },
      data: { esPrincipal: false },
    });
    await tx.vehiculoFoto.update({ where: { id: photoId }, data: { esPrincipal: true } });
    return { status: 'ok' as const };
  });
}

/** Sube o baja una foto una posición intercambiándola con su vecina. En los extremos no cambia nada. */
export async function movePhoto(
  vehicleId: number,
  photoId: number,
  direction: 'up' | 'down'
): Promise<PhotoChangeResult> {
  return prisma.$transaction(async (tx) => {
    if (!(await lockVehicle(tx, vehicleId))) return { status: 'not_found' as const };
    const ids = await renumber(tx, vehicleId);
    const index = ids.indexOf(photoId);
    if (index === -1) return { status: 'not_found' as const };
    const neighbor = direction === 'up' ? index - 1 : index + 1;
    if (neighbor < 0 || neighbor >= ids.length) return { status: 'ok' as const };
    await tx.vehiculoFoto.update({
      where: { id: ids[index]! },
      data: { ordenPresentacion: neighbor + 1 },
    });
    await tx.vehiculoFoto.update({
      where: { id: ids[neighbor]! },
      data: { ordenPresentacion: index + 1 },
    });
    return { status: 'ok' as const };
  });
}

export type DeletePhotoResult = { status: 'ok'; url: string } | { status: 'not_found' };

/**
 * Elimina la fila (el llamador borra después el archivo con la URL devuelta). Si era la principal, promueve la
 * siguiente en el orden, y renumera.
 */
export async function deletePhoto(vehicleId: number, photoId: number): Promise<DeletePhotoResult> {
  return prisma.$transaction(async (tx) => {
    if (!(await lockVehicle(tx, vehicleId))) return { status: 'not_found' as const };
    const photo = await tx.vehiculoFoto.findFirst({
      where: { id: photoId, vehiculoId: vehicleId },
      select: { id: true, urlFoto: true, esPrincipal: true },
    });
    if (!photo) return { status: 'not_found' as const };

    await tx.vehiculoFoto.delete({ where: { id: photo.id } });
    const remaining = await renumber(tx, vehicleId);
    if (photo.esPrincipal && remaining.length > 0) {
      await tx.vehiculoFoto.update({ where: { id: remaining[0]! }, data: { esPrincipal: true } });
    }
    return { status: 'ok' as const, url: photo.urlFoto };
  });
}
