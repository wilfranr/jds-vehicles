import { MEDIA_FILE_PATTERN, getUploadsDir, readMedia } from '@/server/media/storage';

/**
 * Sirve las fotos subidas desde `UPLOADS_DIR` (solo lectura). Acepta exactamente UN segmento con la forma
 * `<uuid>.webp` o `<uuid>_t.webp`; cualquier otra cosa (`..`, separadores, `%2F`, mayúsculas, extensiones) es 404
 * sin tocar el disco. Respuesta con tipo fijo `image/webp`, `nosniff` y caché larga (los nombres son inmutables).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ ruta: string[] }> }
): Promise<Response> {
  const { ruta } = await params;
  const name = ruta.length === 1 ? ruta[0]! : '';
  if (!MEDIA_FILE_PATTERN.test(name)) return notFound();

  const file = await readMedia(getUploadsDir(), name);
  if (!file) return notFound();

  return new Response(new Uint8Array(file), {
    status: 200,
    headers: {
      'Content-Type': 'image/webp',
      'Content-Length': String(file.length),
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}

function notFound(): Response {
  return new Response('Not found', {
    status: 404,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff' },
  });
}
