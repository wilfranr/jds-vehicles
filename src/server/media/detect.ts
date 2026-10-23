export type ImageKind = 'jpeg' | 'png' | 'webp';

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function startsWith(buffer: Uint8Array, bytes: number[], offset = 0): boolean {
  return bytes.every((byte, i) => buffer[offset + i] === byte);
}

/**
 * Tipo de imagen según los PRIMEROS BYTES del contenido (firma), nunca según la extensión ni el `Content-Type`
 * que declara el cliente. Solo JPEG, PNG y WebP; cualquier otra cosa devuelve `null`.
 */
export function detectImageKind(buffer: Uint8Array): ImageKind | null {
  if (buffer.length < 12) return null;
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) return 'jpeg';
  if (startsWith(buffer, PNG_SIGNATURE)) return 'png';
  // WebP: "RIFF" + tamaño (4 bytes) + "WEBP"
  if (
    startsWith(buffer, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(buffer, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return 'webp';
  }
  return null;
}
