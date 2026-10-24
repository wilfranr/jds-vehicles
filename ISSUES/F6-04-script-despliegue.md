# F6-04: Script de despliegue, versiones y reversión

- **Estado:** DONE
- **Fase:** 6
- **Depende de:** F6-02, F6-03
- **Prioridad:** Alta

## Contexto

Despliegue manual y reproducible (sin despliegue automático desde GitHub: exigiría guardar llaves SSH como secretos). Lo ejecuta el orquestador por SSH con la autorización del propietario en cada paso que modifica el servidor.

## Alcance

1. `scripts/deploy/deploy.sh <tag>` (bash, `set -euo pipefail`) que se ejecuta **en el servidor**: obtiene el código de una etiqueta de Git (`git fetch --tags`, `git checkout <tag>`, verificación de que el árbol está limpio), construye la imagen etiquetada con la versión y el commit, **respalda la BD antes de migrar** (script de F5-03), ejecuta `migrate`, levanta `app` con la imagen nueva, espera el `HEALTHCHECK`/`/api/health` hasta un tiempo máximo y, si falla, **vuelve automáticamente** a la imagen anterior (sin deshacer migraciones destructivas: documentar la política de migraciones compatibles hacia atrás en dos pasos).
2. `scripts/deploy/rollback.sh`, `scripts/deploy/status.sh` (versión desplegada, estado de contenedores, últimas líneas de log **sin secretos**) y `scripts/deploy/logs.sh`.
3. Versionado: etiquetas `vMAJOR.MINOR.PATCH` creadas por el orquestador tras fusionar; `CHANGELOG.md` mínimo. El número de versión visible en `/api/health` es opcional y **solo** el hash corto, nunca rutas.
4. Todo script soporta `--dry-run` que imprime lo que haría. Ninguna orden destructiva (`down -v`, `rm -rf`, `prune`) sin confirmación escrita.
5. Pruebas: ejecutar el ciclo completo (desplegar v1 → desplegar v2 → forzar un fallo de salud en v3 → comprobar el rollback automático) **en local con Docker** y pegar la evidencia.
6. `docs/DESPLIEGUE.md`: procedimiento paso a paso, rollback, qué hacer si se pierde el acceso, y registro de lo que cambia en el servidor.

## Criterios de aceptación

- [x] El ciclo v1 → v2 → v3 fallida → rollback automático funciona en local.
- [x] Siempre hay una copia de la BD anterior a cada migración.
- [x] `--dry-run` no modifica nada.
- [x] CI en verde.

## Recordatorio de proceso

Rama `issue/<ID>-<slug>` **desde `main` actualizado**, sin encadenar. PR al terminar y estado `REVIEW`; **no fusionar ni marcar `DONE`**. Pruebas con BD como `*.db.test.ts`; e2e con datos propios. `pnpm check`, `pnpm build` y `pnpm test:e2e` antes de empujar. **Nunca** poner secretos, IPs privadas ni llaves en el repositorio, en logs ni en las notas de entrega. **Lee `AGENTS.md` y la documentación local de Next.**

## Notas de entrega

Procedimiento en `docs/DESPLIEGUE.md`. **Dependencia:** los scripts usan `docker-compose.prod.yml` (F6-02, #74) y `docker-compose.proxy.yml` (F6-03, #75); este PR sale de `main` sin encadenar y **debe fusionarse después de ambos**. El ciclo se probó en local combinando las tres ramas en un repositorio temporal (fuera de este repositorio) con tres etiquetas. Sin secretos ni IPs en el repositorio ni aquí.

**Qué se hizo**

- `scripts/deploy/deploy.sh <vX.Y.Z> [--dry-run]` (se ejecuta en el servidor): `git fetch --tags` (si hay `origin`), existencia de la etiqueta, árbol limpio, `git checkout` de la etiqueta, construcción de `jds_app:<tag>`/`jds_tools:<tag>` con el commit en la etiqueta de la imagen, **respaldo previo** (BD + fotos con `scripts/backup.sh` en el contenedor `tools`; sin respaldo no se migra), `migrate`, `up app proxy`, espera a `healthy` + `/api/health`, **precalentamiento** de `/`, `/catalogo` y `/contacto`, y registro de versión. Si la nueva no llega a estar sana: muestra el log (enmascarado) y **vuelve sola a la anterior** (código de salida 1; 2 si tampoco la anterior está sana).
- `rollback.sh [vX.Y.Z]`, `status.sh` (versión, contenedores, salud, imágenes disponibles, últimas líneas de log enmascaradas) y `logs.sh [servicio] [--tail N] [--follow]`; librería común `lib.sh`. Todos soportan `--dry-run` (donde modifican algo) y **ninguno contiene órdenes destructivas** (`down`, `rm -rf`, `prune`, borrado de volúmenes/contenedores, `restore.sh`): lo vigila una prueba.
- Política de migraciones compatibles hacia atrás en dos pasos (expandir/contraer) en `docs/DESPLIEGUE.md`; sección «Servidor» (F6-01, sin datos sensibles), registro de lo que cambia en el servidor, qué hacer si se pierde el acceso y restauración de datos solo a mano. `CHANGELOG.md` mínimo con plantilla. El número de versión en `/api/health` (opcional) **no** se añadió: `status.sh` lo obtiene de la etiqueta de la imagen.
- Estado del despliegue en `~/.local/state/jds-deploy/` (0600), fuera del repositorio.

**Hallazgos corregidos durante las pruebas**

1. `docker compose up` sale con error cuando `app` queda `unhealthy` (el proxy depende de ella), y con `set -e` el script moría **antes** de la vuelta atrás. Ahora se tolera y decide la espera de salud.
2. `git checkout` de la etiqueta puede cambiar el propio `deploy.sh` mientras se ejecuta (bash lee el archivo de forma incremental): el cuerpo va en una función `main()`, que bash lee entera antes de ejecutarla.
3. El `docker image inspect` de `rollback.sh` se evaluaba también en `--dry-run`; ahora no se ejecuta.
4. `redact` dejaba pasar el valor tras `Authorization: Bearer …`; ahora enmascara la línea entera de `authorization`/`cookie`.

**Evidencia del ciclo (local, Docker, proxy en 127.0.0.1)**

- `deploy.sh v0.0.1 --dry-run`: imprime los 8 pasos «(simulado)», no cambia de etiqueta, no crea estado y no crea contenedores.
- **v0.0.1** (BD vacía): construcción, respaldo `20261024-014136`, migración, arranque, precalentamiento → «OK: v0.0.1 desplegada y sana» (≈2 min 10 s).
- Se sembró roles y un archivo en `/data/uploads`. **v0.0.2**: nuevo respaldo `20261024-014329` → «OK». Estado: `current=v0.0.2`, `previous=v0.0.1`, datos y archivo intactos.
- **v0.0.3** (`/api/health/live` devuelve 500): respaldo `20261024-014900`, migración, arranque → «docker compose up terminó con error… FALLO: v0.0.3 no llegó a estar sana en 120s → Volviendo automáticamente a v0.0.2… Revertido a v0.0.2», código de salida 1. Después: imagen en ejecución `jds_app:v0.0.2` `healthy`, `/api/health` `{"status":"ok","db":"up",…}`, el archivo de subidas sigue ahí, `current=v0.0.2` (la fallida no quedó registrada).
- **Un respaldo por cada intento de migración** (3 despliegues → 3 respaldos más uno de la prueba, en el volumen `jds_backups`); `sha256sum -c` correcto, archivos `0600` y carpeta `0700`.
- `rollback.sh --dry-run` no cambia el estado; `rollback.sh` real a la anterior → «OK: v0.0.1 en marcha»; `status.sh` muestra versión, commit (`org.opencontainers.image.revision`), contenedores, salud, imágenes `v0.0.1…v0.0.3` y log enmascarado; `logs.sh` ídem.
- Al terminar se derribó el stack de pruebas y se eliminaron mis volúmenes e imágenes de prueba (la BD de desarrollo `jds_vehiculos_db` no se tocó).

**Pruebas:** `src/server/deploy-scripts.test.ts` (18): sintaxis y modo estricto, sin órdenes destructivas ni `restore.sh`, sin imprimir el entorno, `redact`, y `--dry-run` en un repositorio temporal con un `docker` falso que falla si se invoca (HEAD intacto, sin estado, sin llamadas a docker), etiquetas inválidas/inexistentes y falta de `JDS_ENV_FILE`. `pnpm check` (84 archivos, 793 pruebas), `pnpm build`, `pnpm test:e2e` ×2: 157/157.

**A revisar**

- **arm64** sigue sin probarse desde x86 (ver F6-02); `deploy.sh` construye en el servidor.
- En el servidor real el árbol de trabajo debe estar limpio y tener `origin` con las etiquetas; sin `origin` solo usa las locales.
- Los logs de la app muestran los avisos `crypto.getRandomValues() while prerendering` (anteriores a la Fase 6): ensucian `status.sh`/`logs.sh`; conviene un issue para encontrar la causa.
- La imagen anterior se conserva (no hay `prune`): con los despliegues se acumulan imágenes (~520 MB cada una); retirarlas es una tarea manual y consciente.
