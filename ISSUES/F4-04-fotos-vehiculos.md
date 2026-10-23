# F4-04: Fotos de vehículos (subida y galería)

- **Estado:** TODO
- **Fase:** 4
- **Depende de:** F4-03
- **Prioridad:** Alta

## Contexto

**Decisión del orquestador por delegación del propietario (demo; revisar antes de producción):** las fotos se guardan en el **disco del servidor** (carpeta fuera de `public/`, configurable con `UPLOADS_DIR`, por defecto `./uploads`, ignorada por git) y se sirven por una ruta propia. Motivo: el servidor Oracle ya es del propietario y evita depender de un servicio externo; el esquema `vehiculo_fotos` ya guarda una URL, así que cambiar luego a un almacenamiento externo solo toca este módulo. Las fotos del seed (URLs externas) siguen funcionando.

**Requisitos de seguridad comunes a toda la Fase 4:** (1) cada página y cada Server Action llama a `requireRole(...)` (además del proxy); el rol sale de la sesión/BD, nunca del formulario; (2) las acciones sensibles usan `getFreshUser()` (el JWT no se revoca); (3) listas explícitas de campos editables (nada de pasar el cuerpo del formulario a Prisma); (4) validación con Zod en servidor; (5) cada cambio relevante escribe un evento de auditoría de una línea JSON (quién, qué, id afectado; sin datos personales ni secretos); (6) los textos y avisos nunca revelan si un registro ajeno existe.

## Alcance

1. Dependencia `sharp` para procesar imágenes (fijar versión exacta; revisar que compile en CI y en el servidor).
2. **Subida segura** (Server Action o ruta con `multipart`): solo JPEG, PNG y WebP **verificados por contenido** (firma de bytes, no por extensión ni por `Content-Type`), máximo 5 MB por archivo y 10 por envío, máximo 20 fotos por vehículo; se **recodifican con sharp a WebP** (elimina metadatos EXIF y cualquier carga embebida), se redimensionan (lado mayor 1600 px) y se generan miniaturas (480 px). Nombres de archivo generados con `crypto.randomUUID()`, nunca derivados del original; sin rutas relativas (`..`, separadores). Rechazar con mensajes claros, sin 500.
3. Ruta de servicio `/media/[...ruta]` (solo lectura): valida el nombre contra un patrón estricto, resuelve dentro de `UPLOADS_DIR` sin escapar (probar `../` y variantes codificadas), responde con `Content-Type` fijo `image/webp`, `X-Content-Type-Options: nosniff` y caché larga con nombres inmutables. Configurar `next/image` para estas rutas.
4. En `/admin/vehiculos/[id]`: galería con subir, marcar **principal** (exactamente una), reordenar (`orden_presentacion`) y eliminar (borra la fila y el archivo; si era la principal, promover la siguiente). Todo en transacción donde aplique.
5. Invalidar la caché del catálogo tras cualquier cambio de fotos.
6. Documentar en el README: `UPLOADS_DIR`, permisos de la carpeta y que debe incluirse en las copias de seguridad (Fase 6).
7. **Tests:** firma de bytes (archivo con extensión .jpg que es otro formato → rechazado), tamaño y cantidad, recodificación elimina EXIF (fixture), traversal en la ruta de servicio, una sola principal, borrado limpia el archivo; autorización (CLIENTE 404).

## Fuera de alcance

Almacenamiento externo, edición de imágenes (recorte), vídeos.

## Criterios de aceptación

- [ ] Subir 3 fotos, marcar la segunda principal y reordenar se refleja en la ficha pública y el catálogo.
- [ ] Un archivo no imagen renombrado a `.jpg` y un archivo de más de 5 MB se rechazan con mensaje claro.
- [ ] `/media/..%2F..%2F.env` y variantes responden 404.
- [ ] `pnpm check`, `pnpm build` y `pnpm test:e2e` pasan; CI en verde.

## Recordatorio de proceso

Rama `issue/<ID>-<slug>` **creada desde `main` actualizado** (`git checkout main && git pull`), nunca encadenada sobre otra rama sin fusionar; si dependes de un issue que aún no está en `main`, espera. PR al terminar y estado `REVIEW`. **No fusionar ni marcar `DONE`.** Texto visible en `site-content.ts`, sin afirmaciones comerciales inventadas. **Lee `AGENTS.md` y la documentación local de Next antes de escribir código.**
