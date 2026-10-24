# F6-02: Imagen de producción y Docker Compose

- **Estado:** TODO
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

- [ ] La imagen arranca como usuario no root y el healthcheck pasa.
- [ ] Recrear `app` no pierde fotos ni datos.
- [ ] Ningún secreto en la imagen ni en el repositorio.
- [ ] `pnpm check`, `pnpm build`, `pnpm test:e2e` y el job de imagen pasan; CI en verde.

## Recordatorio de proceso

Rama `issue/<ID>-<slug>` **desde `main` actualizado**, sin encadenar. PR al terminar y estado `REVIEW`; **no fusionar ni marcar `DONE`**. Pruebas con BD como `*.db.test.ts`; e2e con datos propios. `pnpm check`, `pnpm build` y `pnpm test:e2e` antes de empujar. **Nunca** poner secretos, IPs privadas ni llaves en el repositorio, en logs ni en las notas de entrega. **Lee `AGENTS.md` y la documentación local de Next.**
