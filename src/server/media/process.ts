import 'server-only';

import sharp from 'sharp';
import { detectImageKind } from './detect';
import { MAIN_MAX_SIDE, MAX_INPUT_PIXELS, THUMB_MAX_SIDE } from './limits';

export type ProcessResult =
  | { ok: true; main: Buffer; thumb: Buffer; width: number; height: number }
  | { ok: false; reason: 'not_image' | 'corrupt' };

/**
 * Recodifica SIEMPRE a WebP con sharp: el archivo que se guarda se genera de cero a partir de los píxeles, así
 * se descartan los metadatos (EXIF, GPS, miniaturas incrustadas, perfiles) y cualquier carga embebida o
 * poliglota. Antes comprueba la firma de bytes y que el formato que decodifica sharp coincida con ella.
 * La orientación EXIF se aplica (`rotate`) antes de descartarla para que la imagen no quede girada.
 */
export async function processImage(input: Buffer): Promise<ProcessResult> {
  const kind = detectImageKind(input);
  if (!kind) return { ok: false, reason: 'not_image' };

  try {
    const base = () =>
      sharp(input, { failOn: 'error', limitInputPixels: MAX_INPUT_PIXELS, animated: false });

    const meta = await base().metadata();
    const decoded =
      meta.format === 'jpeg' || meta.format === 'png' || meta.format === 'webp'
        ? meta.format
        : null;
    if (decoded !== kind) return { ok: false, reason: 'not_image' };

    const main = await base()
      .rotate()
      .resize({
        width: MAIN_MAX_SIDE,
        height: MAIN_MAX_SIDE,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    const thumb = await base()
      .rotate()
      .resize({
        width: THUMB_MAX_SIDE,
        height: THUMB_MAX_SIDE,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 75 })
      .toBuffer();

    return { ok: true, main: main.data, thumb, width: main.info.width, height: main.info.height };
  } catch {
    // Archivo con firma válida pero contenido dañado, truncado o demasiado grande en píxeles.
    return { ok: false, reason: 'corrupt' };
  }
}
