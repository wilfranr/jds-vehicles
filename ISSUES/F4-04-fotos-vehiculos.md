# F4-04: Fotos de vehículos (subida y galería)

- **Estado:** DONE
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

- [x] Subir 3 fotos, marcar la segunda principal y reordenar se refleja en la ficha pública y el catálogo.
- [x] Un archivo no imagen renombrado a `.jpg` y un archivo de más de 5 MB se rechazan con mensaje claro.
- [x] `/media/..%2F..%2F.env` y variantes responden 404.
- [x] `pnpm check`, `pnpm build` y `pnpm test:e2e` pasan en local; CI: ver el PR.

## Recordatorio de proceso

Rama `issue/<ID>-<slug>` **creada desde `main` actualizado** (`git checkout main && git pull`), nunca encadenada sobre otra rama sin fusionar; si dependes de un issue que aún no está en `main`, espera. PR al terminar y estado `REVIEW`. **No fusionar ni marcar `DONE`.** Texto visible en `site-content.ts`, sin afirmaciones comerciales inventadas. **Lee `AGENTS.md` y la documentación local de Next antes de escribir código.**

## Notas de entrega

Rama desde `main` actualizado (sin encadenar; no depende de F4-05).

**Qué se hizo**

- **Dependencia:** `sharp` fijado a la versión exacta `0.35.5` (binarios precompilados por plataforma; compila sin scripts de instalación, funciona con `allowBuilds: sharp: false`).
- **Subida** `POST /admin/vehiculos/[id]/fotos` (`route.ts`): **ruta y no Server Action** porque las acciones limitan el cuerpo a 1 MB y subir ese límite habría afectado a todas. Orden deliberado: id válido → **origen** (cabecera `Origin` debe coincidir con el host; 403) → `requireStaff()` (sesión y rol confirmados en la BD) → tamaño **declarado** obligatorio y ≤ ~51 MB → solo entonces se lee el cuerpo. Responde `303` al panel (formulario HTML estándar: funciona sin JavaScript).
- **Validación y procesamiento** (`src/server/media/`): `detect.ts` identifica JPEG/PNG/WebP por la **firma de bytes** (no por extensión ni `Content-Type`); `process.ts` comprueba además que el formato que decodifica `sharp` coincida con la firma y **recodifica SIEMPRE a WebP** desde los píxeles (se pierden EXIF/GPS/ICC y cualquier carga añadida al final del archivo), aplica la orientación EXIF antes de descartarla, limita el lado mayor a 1600 px (miniatura de 480 px, sin ampliar) y limita la entrada a 40 Mpx (bombas de descompresión). `upload.ts` hace **todo o nada**: límites (5 MB, 10 por envío, 20 por vehículo) y procesamiento de cada archivo en memoria antes de escribir nada; si la inserción en BD falla se borran los archivos recién escritos.
- **Almacenamiento** (`storage.ts`): `UPLOADS_DIR` (por defecto `./uploads`, absoluta, fuera de `public/`, ignorada por git); nombres `crypto.randomUUID()` (`<uuid>.webp` y `<uuid>_t.webp`) nunca derivados del original; `wx` (no sobrescribe), modo `640`; `resolveMediaPath` exige el patrón estricto (UUID v4 en minúscula + `.webp`) y comprueba que el resultado quede dentro de la carpeta; el borrado solo actúa sobre URLs `/media/<uuid>.webp` (jamás sobre las URLs externas del seed).
- **Servicio** `GET /media/[...ruta]`: un único segmento con el patrón estricto, si no 404 sin tocar el disco; `Content-Type: image/webp` fijo, `X-Content-Type-Options: nosniff`, `Content-Security-Policy: default-src 'none'; sandbox`, `Cache-Control: public, max-age=31536000, immutable`. La ruta de lectura usa `/* turbopackIgnore */` para no provocar el aviso de «trazado de todo el proyecto» del build (sin avisos).
- **Galería del panel** en `/admin/vehiculos/[id]` (`PhotoManager`): subir, **marcar principal** (siempre exactamente una), **subir/bajar** (botones accesibles; sustituyen al arrastrar) y **eliminar** (confirmación en dos pasos; borra fila y archivos; si era la principal promueve la siguiente y renumera). Servicio `photos.ts`: transacciones con la fila del vehículo bloqueada (`FOR UPDATE`), propiedad (`id` de foto + `vehiculoId`) y tope por vehículo también bajo bloqueo (dos subidas simultáneas no lo superan). Acciones con `requireStaff()`, ids enlazados y validados, y `logAdminEvent` (`vehicle.photos_added|photo_principal_set|photo_moved|photo_deleted`).
- **Público:** `VehicleCard`, `ReservationCard`, el detalle de reserva y `VehicleGallery` usan la **miniatura** (`_t`) en tarjetas y tiras y la imagen completa en la ficha; las fotos de `/media` van con `unoptimized` (ya son WebP redimensionado y evita el bucle del optimizador). El JSON-LD convierte `/media/…` en URL absoluta. Cada cambio invalida la caché del catálogo (`updateTag` en acciones; en la ruta, `revalidateTag(tag, { expire: 0 })`, que descarta la caché al instante porque `updateTag` solo existe en Server Actions).
- **README** (sección «Fotos de Vehículos»: `UPLOADS_DIR`, permisos, copias de seguridad, `sharp` en el servidor y `client_max_body_size` del proxy), `.env.example`, `.gitignore`.

**Pruebas (+ 98):** firma de bytes (GIF, BMP, PDF, HTML, SVG, ELF, RIFF-no-WebP, firma desplazada…); procesamiento con fixtures generadas con `sharp` (EXIF con texto secreto que **desaparece**, orientación, tamaños 1600/480 sin ampliar, PNG/WebP, texto/PHP/SVG renombrado → `not_image`, GIF rechazado aunque `sharp` lo lea, truncado → `corrupt`, JPEG con `<?php` añadido recodificado sin la carga, bomba de píxeles); almacenamiento (patrón con 23 nombres hostiles: `../`, `%2F`, `\`, NUL, mayúsculas, no-v4, espacios…; nombres generados distintos, `wx`, permisos, borrado idempotente que ignora URLs externas); subida con dependencias inyectadas (todo o nada, 5 MB exactos sí / +1 no, 11 archivos, 20 por vehículo, limpieza si falla la inserción o lanza, nombres no derivados del original); ruta `/media` (15 variantes de traversal → 404 con `text/plain` y `nosniff`); servicio con la BD (`photos.db.test.ts`: una sola principal, orden consecutivo, tope y carrera de dos subidas, mover en extremos, borrar la principal promueve y renumera, **una foto de otro vehículo no se puede tocar**); URLs de fotos y JSON-LD absoluto. **9 e2e** (`e2e/admin-fotos.spec.ts`): subir 3 fotos (PNG/JPEG/WebP) → marcar la segunda principal → subir la tercera → **ficha y catálogo públicos reflejan principal (miniatura `_t` en la tarjeta) y orden**; archivo servido como WebP con cabeceras seguras; eliminar la principal (promueve, y **el archivo y su miniatura devuelven 404**); texto renombrado a `.jpg`, +5 MB y JPEG dañado rechazados con mensaje claro y **sin guardar nada**; 11 archivos y tope de 20; **EXIF eliminado** del archivo servido; **12 variantes de traversal en `/media`**; autorización (anónimo → login, CLIENTE rechazado y sin filas, origen ajeno 403, ASESOR 303 y fila creada); vehículo inexistente/id inválido; 360 px.

**Limpieza de archivos en e2e (pedida por el orquestador):** el servidor de e2e arranca con `UPLOADS_DIR=.e2e-uploads` (`playwright.config.ts` + `e2e/test-data.ts`). Cada prueba borra en `afterEach` (aunque falle) los **archivos** de las fotos de sus vehículos además de las filas; `e2e/global-setup.ts` vacía la carpeta al empezar y, al terminar, **falla si queda algún archivo** (verificado dejando uno a propósito: «archivos en UPLOADS_DIR: 1»). Comprobado tras las ejecuciones: la carpeta no existe/está vacía y la BD intacta. Las pruebas filtran el catálogo por el color único de su vehículo (nunca «la primera tarjeta») y no cuentan filas globales.

**Resultado:** `pnpm check` **562** pruebas, `pnpm build` en verde y sin avisos, `pnpm test:e2e` **65 de 65** (6 ejecuciones seguidas tras el último cambio de código relevante).

**Para revisar**

1. **Fotos en disco (decisión de demo):** al desplegar hay que crear la carpeta con permisos, respaldarla junto a la BD y configurar el límite de cuerpo del proxy (~55 MB). No hay purga de archivos huérfanos si se borra un vehículo por SQL (la fila cae por cascada pero el archivo queda); el panel no borra vehículos.
2. **POST de un CLIENTE** a la ruta de subida responde 400 (el proxy lo reescribe a la página «no encontrado» y Next rechaza un POST a una página), no 404; no se acepta ni se guarda nada (probado). Un anónimo recibe 307 a login.
3. **`sharp` y el tipo de contenido:** se acepta lo que decodifica como JPEG/PNG/WebP y coincide con la firma; WebP animado se reduce a su primer fotograma.
4. **Reordenar** se hace con botones «Subir/Bajar» (accesibles por teclado) y no con arrastrar y soltar.
5. El **CI** instala `sharp` con el lockfile (binarios opcionales de la plataforma); el E2E de CI crea `.e2e-uploads` en el directorio de trabajo.
6. `invalidateCatalogImmediately()` (`revalidateTag(tag, { expire: 0 })`) es nuevo y solo lo usa la ruta de subida.

**Cómo verificar**: `pnpm db:seed && pnpm check && pnpm build && pnpm test:e2e`; manualmente, como ASESOR en `/admin/vehiculos/[id]`, subir 3 fotos, marcar la segunda como principal y revisar la ficha pública; `curl -i localhost:3000/media/..%2F..%2F.env` devuelve 404.
