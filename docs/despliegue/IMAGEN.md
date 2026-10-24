# Imagen de producción y Docker Compose (F6-02)

Esta guía describe **qué es** la imagen, cómo se construye y cómo se prueba. El procedimiento de despliegue está en
`docs/DESPLIEGUE.md` (F6-04) y el proxy HTTPS en `docs/despliegue/PROXY.md` (F6-03). Nunca se guardan secretos, IPs ni
llaves en el repositorio: el archivo de entorno real vive **solo en el servidor** (`chmod 600`).

## Piezas

| Archivo                           | Para qué                                                                                                   |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `Dockerfile`                      | Multi-etapa. Destinos finales: `runner` (la aplicación) y `tools` (migraciones, primer admin, respaldos).  |
| `docker-compose.prod.yml`         | Servicios `db`, `migrate`, `app` y `tools` (perfil `tools`, no arranca con `up`). Prefijo `jds_` en todo.  |
| `docker-compose.local-test.yml`   | **Solo pruebas locales**: publica la app en `127.0.0.1` para probarla sin proxy. No se usa en el servidor. |
| `.env.prod.example`               | Plantilla del archivo de entorno (sin valores reales). Una prueba la valida contra `src/server/env.ts`.    |
| `scripts/docker/build-with-db.sh` | Compilación contra una BD efímera (ver «Por qué la compilación levanta una BD»).                           |
| `scripts/docker/smoke.sh`         | Prueba de humo de la imagen y del stack (la usa el CI; también `pnpm docker:humo`).                        |

## Construcción

La imagen se construye **en el propio servidor** para que `sharp` y el motor de Prisma sean los de `linux/arm64`:

```bash
# En el servidor (arm64), desde la etiqueta a desplegar:
export JDS_ENV_FILE=/ruta/segura/.env.prod
docker compose --env-file "$JDS_ENV_FILE" -f docker-compose.prod.yml build \
  --build-arg GIT_COMMIT="$(git rev-parse --short HEAD)"
```

El CI (x86) solo comprueba que el Dockerfile construye y que el stack arranca (job «Docker image (build + smoke)»).
**La construcción arm64 no se ha podido probar desde una máquina x86 sin emulación**: la comprueba el orquestador en el
servidor. Para intentarlo desde x86 con emulación (requiere `docker buildx` y `qemu`/binfmt):

```bash
docker buildx build --platform linux/arm64 --target runner --load -t jds_app:arm64-test \
  --build-arg NEXT_PUBLIC_SITE_URL=https://ejemplo.invalid .
```

`NEXT_PUBLIC_SITE_URL` y `NEXT_PUBLIC_WHATSAPP_NUMBER` se **incrustan en el código del cliente al compilar**: cambiarlos
exige reconstruir la imagen (Compose las toma del archivo de entorno en `args`).

### Por qué la compilación levanta una BD

`next build` consulta la base de datos al prerenderizar (portada, configuración del concesionario, sitemap) y durante
`docker build` no hay red hacia el MySQL de producción. `scripts/docker/build-with-db.sh` levanta un **MariaDB efímero**
dentro de la etapa de compilación (no llega a la imagen final), aplica las migraciones y el seed de producción (solo
roles y configuración) y compila contra él. Consecuencias que conviene conocer:

- El HTML prerenderizado nace con el **catálogo vacío** y la configuración por defecto. La caché de Next (`use cache`,
  revalidación de 1 a 15 min) lo refresca con las primeras visitas; **tras cada despliegue conviene precalentar** `/`,
  `/catalogo` y `/contacto` (lo hará `deploy.sh`, F6-04) para que nadie vea esa primera versión.
- Cada compilación descarga ~100 MB de paquetes de MariaDB (cacheado por capas mientras no cambie la etapa base).

### Salida `standalone`

`output: 'standalone'` se activa solo con `NEXT_OUTPUT=standalone` (lo fija el Dockerfile): `next start`, el CI y los
e2e no cambian. Con la salida mínima la imagen `runner` pesa **~520 MB** (127 MB de aplicación sobre `node:22-bookworm-slim`)
frente a más de 1,6 GB de la imagen con todas las dependencias (`tools`). El trazado excluye los `*.test.*`.

## Servicios

- **`db`**: `mysql:8.0.46`, `utf8mb4`, volumen `jds_mysql_data`, **sin puerto publicado**, `mem_limit` 1 GB
  (`innodb_buffer_pool_size` 256 MB), healthcheck con `mysqladmin ping` (la contraseña va en `MYSQL_PWD`, no en la línea de comandos).
- **`migrate`**: un solo uso, `prisma migrate deploy`; arranca solo con `db` sana (`depends_on: service_healthy`) y la app espera
  a que termine bien (`service_completed_successfully`). Nunca `migrate dev` ni `db push`.
- **`app`**: `node server.js` (un único proceso de Node: los limitadores son en memoria), usuario `node` (uid 1000), `init: true`,
  `restart: unless-stopped`, `mem_limit` 768 MB, sin puertos publicados (`expose: 3000`; la entrada pública es el proxy, F6-03).
  Sistema de archivos **de solo lectura**; solo se escribe en `/data/uploads` (volumen `jds_uploads`), `/tmp` y `/app/.next/cache` (tmpfs).
  `HEALTHCHECK` contra `/api/health/live` con el propio Node (la imagen no tiene `curl`). `cap_drop: ALL` y `no-new-privileges`.
- **`tools`** (perfil `tools`): Prisma CLI, `tsx`, cliente MariaDB y los scripts de respaldo, con los volúmenes `jds_uploads` y `jds_backups`.
- Todos los servicios rotan sus logs (`json-file`, 10 MB × 5). Red `jds_internal`; volúmenes `jds_mysql_data`, `jds_uploads`, `jds_backups`.

Memoria total reservada para JDS: 768 MB (app) + 1 GB (BD) + proxy; con ~23 GB en el servidor cabe con holgura junto a la otra aplicación.
En reposo, medido en local: app ≈ 67 MB y BD ≈ 400 MB.

## Primer arranque (en el servidor, con el archivo de entorno ya creado)

```bash
export JDS_ENV_FILE=/ruta/segura/.env.prod
C="docker compose --env-file $JDS_ENV_FILE -f docker-compose.prod.yml"
$C build
$C up -d db                                  # BD sana
$C run --rm tools pnpm prisma migrate deploy  # (también lo hace `up` mediante el servicio migrate)
$C run --rm tools pnpm prisma db seed        # UNA sola vez: roles y configuración base (en producción NO crea usuarios demo)
$C up -d app
$C run --rm tools pnpm admin:crear           # primer administrador (contraseña por entrada oculta)
```

El seed de producción no sobrescribe los valores de configuración existentes, pero **solo se ejecuta en la puesta en marcha**.
Desde otra máquina con la BD en la red interna no hay acceso: la BD no publica puertos.

## Prueba local (sin tocar ningún servidor)

```bash
cp .env.prod.example .env.prod.local     # rellena con valores de PRUEBA (el archivo está ignorado por git)
pnpm docker:humo                         # construye, levanta db→migrate→app, comprueba y destruye (proyecto jds_smoke)
# o a mano, con la app publicada solo en 127.0.0.1:
JDS_ENV_FILE=.env.prod.local docker compose --env-file .env.prod.local \
  -f docker-compose.prod.yml -f docker-compose.local-test.yml up -d
```

`NEXT_PUBLIC_SITE_URL=http://localhost:3300` permite iniciar sesión en local: Chromium acepta las cookies `Secure` en
`localhost` aunque sea HTTP. En el servidor hace falta HTTPS (F6-03).

## Qué comprueba `scripts/docker/smoke.sh`

HEALTHCHECK de la imagen, `migrate` con éxito, app como usuario no root, sistema de archivos de solo lectura, `db` sin puertos,
`/api/health` sano, portada, **sin `.env`, `.git` ni llaves en la imagen**, sin secretos en el entorno de la imagen y que recrear
`app` conserva el contenido del volumen de subidas. Usa su propio proyecto (`jds_smoke`) y volúmenes `jds_smoke_*`: nunca los reales.

## Notas

- `tools` es grande (≈1,7 GB: todas las dependencias); no se ejecuta de forma permanente.
- Tras un despliegue, las pestañas abiertas con la versión anterior pueden mostrar «Failed to find Server Action» al enviar un
  formulario (las acciones cambian con cada compilación): basta recargar.
- El log del servidor muestra avisos `crypto.getRandomValues() while prerendering` (ya presentes antes de la Fase 6; las páginas responden bien): pendiente de un issue propio.
