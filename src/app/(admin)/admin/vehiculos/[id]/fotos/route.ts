import { logAdminEvent } from '@/server/admin/audit';
import { addPhotos, countVehiclePhotos } from '@/server/admin/photos';
import { requireStaff } from '@/server/auth/staff';
import { parseVehicleId } from '@/lib/vehicle-id';
import { MAX_REQUEST_BYTES } from '@/server/media/limits';
import { getUploadsDir } from '@/server/media/storage';
import { uploadVehiclePhotos, type IncomingFile } from '@/server/media/upload';
import { invalidateCatalogImmediately } from '@/server/reservations';

/**
 * Subida de fotografías (multipart). Es una ruta y no una Server Action porque las acciones limitan el cuerpo a
 * 1 MB y subir el límite afectaría a todas. El orden es deliberado: origen → sesión y rol (con la BD) → tamaño
 * declarado → solo entonces se lee el cuerpo. Responde con 303 al panel (funciona sin JavaScript).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id: rawId } = await params;
  const vehicleId = parseVehicleId(rawId);
  if (vehicleId === null) return new Response('Not found', { status: 404 });

  // Defensa adicional contra peticiones de otro origen (la cookie ya es SameSite=Lax).
  const origin = request.headers.get('origin');
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  if (origin !== null && (!host || new URL(origin).host !== host)) {
    return new Response('Forbidden', { status: 403 });
  }

  const user = await requireStaff(`/admin/vehiculos/${vehicleId}`);
  const back = (query: string) =>
    new Response(null, {
      status: 303,
      headers: { Location: `/admin/vehiculos/${vehicleId}?${query}` },
    });

  // Se exige un tamaño declarado válido (el servidor HTTP no entrega más bytes de los declarados): así un cuerpo
  // «chunked» sin tamaño o gigante no llega a cargarse en memoria.
  const declared = Number(request.headers.get('content-length'));
  if (!Number.isFinite(declared) || declared <= 0 || declared > MAX_REQUEST_BYTES) {
    return back('fotoError=requestTooLarge');
  }

  let files: IncomingFile[];
  try {
    const form = await request.formData();
    files = form
      .getAll('fotos')
      .filter((v): v is File => v instanceof File && v.size > 0)
      .map((file) => ({
        size: file.size,
        read: async () => Buffer.from(await file.arrayBuffer()),
      }));
  } catch {
    return back('fotoError=generic');
  }

  const result = await uploadVehiclePhotos(vehicleId, files, {
    uploadsDir: getUploadsDir(),
    countExisting: countVehiclePhotos,
    insert: addPhotos,
  });

  if (result.status === 'error') {
    return back(`fotoError=${result.code}${result.index ? `&n=${result.index}` : ''}`);
  }

  logAdminEvent({
    actorId: user.id,
    action: 'vehicle.photos_added',
    entity: 'vehicle',
    entityId: vehicleId,
    detail: `fotos: ${result.count}`,
  });
  invalidateCatalogImmediately();
  return back(`foto=subidas&n=${result.count}`);
}
