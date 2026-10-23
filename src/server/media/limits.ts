/** Límites de la subida de fotos (F4-04). Únicos lugares donde se definen. */
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_FILES_PER_UPLOAD = 10;
export const MAX_PHOTOS_PER_VEHICLE = 20;
/** Lado mayor de la imagen final y de la miniatura. */
export const MAIN_MAX_SIDE = 1600;
export const THUMB_MAX_SIDE = 480;
/** Tope de píxeles de entrada (evita «bombas de descompresión»): ~40 megapíxeles. */
export const MAX_INPUT_PIXELS = 40_000_000;
/** Tamaño máximo de todo el cuerpo de la petición (10 archivos de 5 MB más la sobrecarga multipart). */
export const MAX_REQUEST_BYTES = MAX_FILES_PER_UPLOAD * MAX_FILE_BYTES + 1024 * 1024;
