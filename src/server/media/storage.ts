import 'server-only';

import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

/** Carpeta de subidas: `UPLOADS_DIR` o `./uploads`; siempre absoluta y fuera de `public/`. */
export function getUploadsDir(env: Record<string, string | undefined> = process.env): string {
  // `turbopackIgnore`: carpeta elegida en tiempo de ejecución; evita que se trace todo el proyecto en el despliegue.
  return path.resolve(/* turbopackIgnore: true */ env.UPLOADS_DIR?.trim() || './uploads');
}

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
/** Único patrón de nombre que se sirve o se borra: `<uuid>.webp` y su miniatura `<uuid>_t.webp`. */
export const MEDIA_FILE_PATTERN = new RegExp(`^(${UUID})(_t)?\\.webp$`);
export const MEDIA_URL_PREFIX = '/media/';
const MEDIA_URL_PATTERN = new RegExp(`^${MEDIA_URL_PREFIX}(${UUID})\\.webp$`);

/** URL pública guardada en `vehiculo_fotos.url_foto` para el id generado. */
export function mediaUrl(id: string): string {
  return `${MEDIA_URL_PREFIX}${id}.webp`;
}

/**
 * Ruta absoluta de un archivo de medios dentro de `uploadsDir`, o `null` si el nombre no cumple el patrón
 * estricto o si el resultado escapara de la carpeta (defensa en profundidad: el patrón ya excluye `/`, `\`, `..`
 * y cualquier carácter fuera de `[0-9a-f-_.]`).
 */
export function resolveMediaPath(uploadsDir: string, name: string): string | null {
  if (!MEDIA_FILE_PATTERN.test(name)) return null;
  const root = path.resolve(uploadsDir);
  const full = path.resolve(root, name);
  return full.startsWith(root + path.sep) ? full : null;
}

export interface StoredImage {
  id: string;
  url: string;
}

/** Guarda la imagen y su miniatura con un nombre generado (`randomUUID`, nunca derivado del original). */
export async function saveImagePair(
  uploadsDir: string,
  files: { main: Buffer; thumb: Buffer }
): Promise<StoredImage> {
  await mkdir(uploadsDir, { recursive: true, mode: 0o750 });
  const id = randomUUID();
  const mainPath = resolveMediaPath(uploadsDir, `${id}.webp`);
  const thumbPath = resolveMediaPath(uploadsDir, `${id}_t.webp`);
  if (!mainPath || !thumbPath) throw new Error('Nombre de archivo inválido');
  // `wx`: nunca sobrescribe un archivo existente.
  await writeFile(mainPath, files.main, { flag: 'wx', mode: 0o640 });
  try {
    await writeFile(thumbPath, files.thumb, { flag: 'wx', mode: 0o640 });
  } catch (error) {
    await rm(mainPath, { force: true });
    throw error;
  }
  return { id, url: mediaUrl(id) };
}

/** Borra los archivos de una foto subida por el panel. Ignora URLs que no cumplan el patrón (p. ej. las del seed). */
export async function deleteImagePair(uploadsDir: string, url: string): Promise<void> {
  const match = MEDIA_URL_PATTERN.exec(url);
  if (!match) return;
  const id = match[1]!;
  for (const name of [`${id}.webp`, `${id}_t.webp`]) {
    const file = resolveMediaPath(uploadsDir, name);
    if (file) await rm(file, { force: true });
  }
}

/** Lee un archivo de medios ya validado por nombre; `null` si no existe. */
export async function readMedia(uploadsDir: string, name: string): Promise<Buffer | null> {
  const file = resolveMediaPath(uploadsDir, name);
  if (!file) return null;
  try {
    // `turbopackIgnore`: la ruta es dinámica a propósito (carpeta de subidas en tiempo de ejecución); sin esto
    // el trazado de archivos incluiría todo el proyecto en el despliegue.
    return await readFile(/* turbopackIgnore: true */ file);
  } catch {
    return null;
  }
}
