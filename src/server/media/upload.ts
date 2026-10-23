import 'server-only';

import { MAX_FILE_BYTES, MAX_FILES_PER_UPLOAD, MAX_PHOTOS_PER_VEHICLE } from './limits';
import { processImage } from './process';
import { deleteImagePair, saveImagePair } from './storage';

export interface IncomingFile {
  /** Tamaño real en bytes (no el declarado por el cliente). */
  size: number;
  read: () => Promise<Buffer>;
}

export type UploadErrorCode =
  'none' | 'tooManyFiles' | 'tooLarge' | 'notImage' | 'corrupt' | 'limit' | 'notFound';

export type UploadResult =
  | { status: 'ok'; count: number; ids: number[] }
  | {
      status: 'error';
      code: UploadErrorCode;
      /** Posición (1..n) de la foto que falló. */ index?: number;
    };

export interface UploadDeps {
  uploadsDir: string;
  /** Fotos que ya tiene el vehículo (`null` si no existe). */
  countExisting: (vehicleId: number) => Promise<number | null>;
  /** Inserta las filas; devuelve los ids o el motivo del rechazo. */
  insert: (
    vehicleId: number,
    urls: string[]
  ) => Promise<{ status: 'ok'; ids: number[] } | { status: 'limit' } | { status: 'not_found' }>;
}

/**
 * Valida, recodifica y guarda las fotos de un vehículo. Todo o nada: primero se comprueban límites y se procesa
 * CADA archivo en memoria (firma de bytes → sharp → WebP); solo si todos son válidos se escriben en disco y se
 * insertan las filas. Si la inserción falla, se borran los archivos recién escritos.
 */
export async function uploadVehiclePhotos(
  vehicleId: number,
  files: IncomingFile[],
  deps: UploadDeps
): Promise<UploadResult> {
  if (files.length === 0) return { status: 'error', code: 'none' };
  if (files.length > MAX_FILES_PER_UPLOAD) return { status: 'error', code: 'tooManyFiles' };

  for (const [i, file] of files.entries()) {
    if (file.size > MAX_FILE_BYTES) return { status: 'error', code: 'tooLarge', index: i + 1 };
  }

  const existing = await deps.countExisting(vehicleId);
  if (existing === null) return { status: 'error', code: 'notFound' };
  if (existing + files.length > MAX_PHOTOS_PER_VEHICLE) return { status: 'error', code: 'limit' };

  const processed = [];
  for (const [i, file] of files.entries()) {
    const result = await processImage(await file.read());
    if (!result.ok) {
      return {
        status: 'error',
        code: result.reason === 'not_image' ? 'notImage' : 'corrupt',
        index: i + 1,
      };
    }
    processed.push(result);
  }

  const stored = [];
  try {
    for (const image of processed) stored.push(await saveImagePair(deps.uploadsDir, image));
    const inserted = await deps.insert(
      vehicleId,
      stored.map((s) => s.url)
    );
    if (inserted.status === 'ok') return { status: 'ok', count: stored.length, ids: inserted.ids };
    await Promise.all(stored.map((s) => deleteImagePair(deps.uploadsDir, s.url)));
    return { status: 'error', code: inserted.status === 'limit' ? 'limit' : 'notFound' };
  } catch (error) {
    await Promise.all(stored.map((s) => deleteImagePair(deps.uploadsDir, s.url)));
    throw error;
  }
}
