# F6-02: Imagen de producción y Docker Compose

- **Estado:** DONE
- **Fase:** 6
- **Depende de:** F5-03 (entorno validado, salud, respaldos, primer administrador)
- **Prioridad:** Alta

## Contexto

Se despliega con contenedores en un servidor Ubuntu/Debian con Docker. F6-01 confirmó que el servidor es **ARM (linux/arm64)** y que **ya aloja otra aplicación** (no tocarla): la imagen se construye **en el propio servidor** (`docker compose build`) para que `sharp` y Prisma usen los binarios arm64; el CI (x86) solo comprueba que el Dockerfile construye. Todos los nombres (proyecto Compose, contenedores, red, volúmenes) llevan el prefijo `jds_`. Decisión: **un solo proceso de Node** (el limitador de intentos es en memoria).

## Alcance

1. `Dockerfile` multi-etapa: `node:22` (versión de `.nvmrc`/`engines`), `corepack`/`pnpm` con la versión fijada, instalación con `--frozen-lockfile`, `prisma generate`, `next build` (evaluar `output: 'standalone'` con la documentación local de Next 16 y medirlo), imagen final sin dependencias de desarrollo, usuario **no root**, sistema de archivos de solo lectura salvo `UPLOADS_DIR` y `/tmp`, `HEALTHCHECK` contra `/api/health/live`. `.dockerignore` que excluya `.env*`, `.git`, `node_modules`, `uploads`, `test-results`.
2. `docker-compose.prod.yml`: servicios `app` (reinicio `unless-stopped`, límites de memoria, `init: true`, sin puertos publicados al host; la memoria de la app y de MySQL debe caber con holgura junto a la otra aplicación), `db` (MySQL 8 con volumen con nombre, **sin puerto publicado**, contraseñas desde archivo de entorno del servidor, `utf8mb4`, comprobación de salud) y `migrate` (servicio de un solo uso: `prisma migrate deploy`, y solo si la BD está sana). Volúmenes: datos de MySQL, `uploads` y respaldos. Rotación de logs de Docker (`json-file`, `max-size`, `max-file`).
3. `.env.prod.example` (sin valores reales) con todas las variables validadas por F5-03; el archivo real vive **solo en el servidor** (`chmod 600`, fuera del repositorio).
4. **Prueba local completa** contra Docker: `docker compose -f docker-compose.prod.yml up` con una BD temporal, migrar, crear el primer admin con `pnpm admin:crear` dentro del contenedor, abrir el sitio y subir una foto (la carpeta persiste tras recrear el contenedor). Pegar la evidencia (sin secretos).
5. CI: un job que **construya la imagen** (sin publicarla) y ejecute el `HEALTHCHECK`/humo contra una BD de servicio, para detectar que el Dockerfile no se rompe.
6. Tamaño y contenido de la imagen documentados (`docker history`/`docker image ls`), y verificar que no contiene `.env`, llaves ni el directorio `.git`.

## Criterios de aceptación

- [x] La imagen arranca como usuario no root y el healthcheck pasa.
- [x] Recrear `app` no pierde fotos ni datos.
- [x] Ningún secreto en la imagen ni en el repositorio.
- [x] `pnpm check`, `pnpm build`, `pnpm test:e2e` y el job de imagen pasan; CI en verde.

## Recordatorio de proceso

Rama `issue/<ID>-<slug>` **desde `main` actualizado**, sin encadenar. PR al terminar y estado `REVIEW`; **no fusionar ni marcar `DONE`**. Pruebas con BD como `*.db.test.ts`; e2e con datos propios. `pnpm check`, `pnpm build` y `pnpm test:e2e` antes de empujar. **Nunca** poner secretos, IPs privadas ni llaves en el repositorio, en logs ni en las notas de entrega. **Lee `AGENTS.md` y la documentación local de Next.**

## Notas de entrega

Guía completa en `docs/despliegue/IMAGEN.md`. Probado en local (x86_64, Docker 29, Compose 5, constructor clásico) con una BD temporal y un archivo de entorno de prueba; **la construcción arm64 no se ha probado** (ver «A revisar»). Sin secretos ni IPs en el repositorio ni en estas notas.

**Qué se hizo**

1. `Dockerfile` multi-etapa sobre `node:22-bookworm-slim` (versión de `.nvmrc`), pnpm por `corepack` con la versión de `packageManager`, `pnpm install --frozen-lockfile`, `prisma generate`, salida `standalone` y dos destinos: `runner` (la app, usuario `node`, `HEALTHCHECK` con el propio Node contra `/api/health/live`) y `tools` (Prisma CLI, `tsx`, cliente MariaDB y scripts de F5-03 para migraciones, primer admin y respaldos). `.dockerignore` excluye `.env*`, `.git`, `node_modules`, `uploads`, `test-results`, etc.
2. `docker-compose.prod.yml` (proyecto `jds`, todo con prefijo `jds_`): `db` (MySQL 8.0.46, volumen, sin puertos, healthcheck, utf8mb4), `migrate` (un solo uso, solo con la BD sana), `app` (sin puertos publicados, `read_only`, `cap_drop: ALL`, `no-new-privileges`, `init`, límites de memoria 768 MB app / 1 GB BD, tmpfs para `/tmp` y la caché de Next) y `tools` (perfil, para `admin:crear` y respaldos). Volúmenes `jds_mysql_data`, `jds_uploads`, `jds_backups`. Logs `json-file` 10 MB × 5. `docker-compose.local-test.yml` publica la app en `127.0.0.1` solo para pruebas locales.
3. `.env.prod.example` sin valores reales; una prueba (`env-prod-example.test.ts`) lo contrasta con `src/server/env.ts` (solo variables conocidas, incluye las exigidas, secretos vacíos, rellenado pasa la validación de producción).
4. `scripts/docker/smoke.sh` (`pnpm docker:humo`) y job de CI **«Docker image (build + smoke)»**: construye `app` y `tools`, levanta db → migrate → app con un entorno aleatorio generado en el job, y comprueba lo de abajo. Usa su propio proyecto `jds_smoke` (volúmenes `jds_smoke_*`).

**Decisiones y hallazgos**

- **`next build` necesita una BD** (portada, configuración, sitemap) y `docker build` no tiene red hacia MySQL: la etapa de compilación levanta un **MariaDB efímero** (`scripts/docker/build-with-db.sh`), aplica migraciones y el seed de producción y compila contra él (nunca llega a la imagen final). Sin BD el build falla (comprobado). Efecto: el HTML prerenderizado nace con el catálogo vacío; la revalidación lo refresca y el despliegue (F6-04) debe **precalentar** `/`, `/catalogo` y `/contacto`.
- **Seed de producción:** se ejecuta una sola vez (`pnpm prisma db seed` en `tools`; no crea usuarios demo) porque `admin:crear` exige los roles. Se cambió `prisma/seed.ts` para que **no pise los valores de configuración existentes** (antes el `upsert` los sobrescribía en cada ejecución, p. ej. el WhatsApp que el propietario cambia desde el panel).
- `output: 'standalone'` solo con `NEXT_OUTPUT=standalone` (lo fija el Dockerfile): `next start`, CI y e2e no cambian. Se excluyen los `*.test.*` del trazado.
- Las `NEXT_PUBLIC_*` se incrustan al compilar (build args desde el archivo de entorno).
- `tools` lleva pnpm ya descargado (`COREPACK_HOME` en la imagen): con el sistema de archivos de solo lectura y sin salida a Internet `pnpm admin:crear` fallaba al intentar bajarlo.

**Evidencia (local)**

- Imágenes: `jds_app` **519 MB** (127 MB de aplicación sobre el Node slim), `jds_tools` ~1,7 GB. Contenido: `/app` con `server.js`, `.next`, `public`, `package.json` y solo `node_modules` trazados; entorno de la imagen sin secretos (`PATH NODE_VERSION YARN_VERSION NODE_ENV NEXT_TELEMETRY_DISABLED PORT HOSTNAME UPLOADS_DIR`); `find` sin `.env`, `.git` ni llaves (solo certificados raíz del sistema).
- Arranque: `jds_db healthy` → `jds_migrate Exited (0)` → `jds_app Up (healthy)`. `uid=1000(node)`; `touch /app/x` → «Read-only file system»; `/data/uploads` y `/app/.next/cache` escribibles. `ReadonlyRootfs=true CapDrop=[ALL] SecurityOpt=[no-new-privileges:true]`; `db` con `Ports={}`.
- `GET /api/health` → `{"status":"ok","db":"up","uploads":"ok","disk":"ok"}` con `Cache-Control: no-store`; `/api/health/live` → `{"status":"ok"}`.
- Primer admin dentro del contenedor: `pnpm prisma db seed` y `pnpm admin:crear --password-from-env` → «Administrador creado (id 1)»; el segundo intento sale con código 2 («Ya existe un administrador»).
- Navegador (Chromium contra `localhost`): inicio de sesión correcto (cookies `__Secure-authjs.*`, `Secure`, `HttpOnly`), alta de marca/modelo/vehículo desde el panel y **subida de una foto** (`/media/<uuid>_t.webp`).
- **Recrear `app`** (`up -d --force-recreate --no-deps app`): la foto sigue sirviéndose con el mismo SHA-256, la ficha y los datos siguen y vuelve a quedar `healthy`.
- Memoria en reposo: app ≈ 67 MiB / 768, BD ≈ 400 MiB / 1 GiB. Logs sin contraseñas ni `AUTH_SECRET`.
- `scripts/docker/smoke.sh` completo: «HUMO OK» (10 comprobaciones, ~2 min con caché).

**Pruebas:** `pnpm check` (84 archivos, 780 pruebas), `pnpm build`, `pnpm test:e2e` ×3: 157/157. Una ejecución de `pnpm check` falló una vez en el barrido de expiración de reservas de BD (`expired: 1` en lugar de 0) y pasó al repetirla: es una prueba que cuenta filas globales (probable residuo temporal de otra suite); conviene vigilarla.

**A revisar**

- **arm64:** no se pudo probar aquí (máquina x86 sin `buildx`/qemu). Puntos que podrían diferir: `mariadb-server` arm64 en la etapa de compilación y los binarios de `sharp`/Prisma (se generan en esa misma arquitectura). Comando de comprobación en `docs/despliegue/IMAGEN.md`.
- La compilación arrastra ~100 MB de MariaDB por construcción (cacheable por capas).
- Quedan fuera de este issue (F6-03/F6-04): el proxy HTTPS, el precalentamiento tras desplegar y el respaldo previo a migrar.
- Persisten en el log avisos `crypto.getRandomValues() while prerendering` (anteriores a la Fase 6; las páginas responden bien).
