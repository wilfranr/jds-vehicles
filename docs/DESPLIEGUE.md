# Despliegue (F6-04)

Despliegue **manual y reproducible**, ejecutado por el orquestador por SSH con la autorización del propietario en cada paso que
modifica el servidor (no hay despliegue automático desde GitHub: exigiría guardar llaves SSH como secretos). El agente
desarrollador **no** tiene acceso al servidor. Aquí no hay secretos, IPs ni llaves; el archivo de entorno real vive solo en el servidor.

Documentos relacionados: `docs/despliegue/IMAGEN.md` (imagen y Compose), `docs/despliegue/PROXY.md` (HTTPS), `README.md` (operación y
respaldos), `CHANGELOG.md` y `ISSUES/PENDIENTES-PROPIETARIO.md`.

## Servidor (reconocimiento F6-01, sin datos sensibles)

- Ubuntu 24.04 LTS, **ARM (aarch64)**, 4 CPU, ~23 GB de RAM, ~32 GB de disco libres. Docker 29 y Compose 2.40.
- **Convive con otra aplicación** (nginx del host en el puerto 80, contenedores y un MySQL propios). JDS **publica solo el 443**, no toca nginx ni los puertos 80, 3306, 8000 ni 8080.
- Sin `ufw` (no se instala). La protección de red es la lista de seguridad de Oracle (22, 80 y 443 abiertos).
- Todo lo de JDS lleva el prefijo `jds_`: proyecto Compose `jds`, contenedores `jds_app`, `jds_db`, `jds_migrate`, `jds_proxy`, `jds_tools`, red `jds_internal`, volúmenes `jds_mysql_data`, `jds_uploads`, `jds_backups`, `jds_caddy_data`, `jds_caddy_config`.
- Las imágenes se construyen **en el propio servidor** (linux/arm64).

## Qué cambia en el servidor (registro)

| Elemento              | Detalle                                                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Copia del repositorio | Un directorio con el código (`git checkout` de la etiqueta); sin secretos dentro.                                        |
| Archivo de entorno    | Fuera del repositorio, `chmod 600`; ruta en `JDS_ENV_FILE`.                                                              |
| Estado del despliegue | `~/.local/state/jds-deploy/` (`current`, `previous`, `commit`, `last_backup`), modo 0600.                                |
| Imágenes Docker       | `jds_app:<vX.Y.Z>` y `jds_tools:<vX.Y.Z>` por versión (se conservan para `rollback.sh`); `caddy:2.10.2`, `mysql:8.0.46`. |
| Puertos               | Solo el **443/TCP** (proxy). El 80 y los demás no se tocan.                                                              |
| Volúmenes             | Los `jds_*` anteriores. **Nunca se borran** desde los scripts.                                                           |
| Otras aplicaciones    | No se modifican.                                                                                                         |

Cada vez que algo de esta tabla cambie, se anota aquí en el mismo PR.

## Primera puesta en marcha (una sola vez)

La detalla F6-05; en resumen, con el archivo de entorno ya creado (ver `.env.prod.example` y `deploy/proxy/env.proxy.example`):

```bash
export JDS_ENV_FILE=/ruta/segura/.env.prod
scripts/deploy/deploy.sh v0.1.0                       # construye, respalda, migra y levanta app + proxy
C="docker compose --env-file $JDS_ENV_FILE -f docker-compose.prod.yml -f docker-compose.proxy.yml"
JDS_VERSION=v0.1.0 $C run --rm tools pnpm prisma db seed   # UNA vez: roles y configuración base
JDS_VERSION=v0.1.0 $C run --rm tools pnpm admin:crear      # primer administrador
```

## Desplegar una versión

1. **En tu máquina:** fusionar los PR aprobados en `main`, actualizar `CHANGELOG.md` y crear la etiqueta (`git tag vX.Y.Z && git push origin vX.Y.Z`).
2. **En el servidor** (tras la autorización del propietario):

```bash
cd /ruta/al/repositorio
export JDS_ENV_FILE=/ruta/segura/.env.prod
scripts/deploy/deploy.sh vX.Y.Z --dry-run     # revisa el plan (no modifica nada)
scripts/deploy/deploy.sh vX.Y.Z
scripts/deploy/status.sh
```

`deploy.sh` hace, en orden y deteniéndose ante cualquier error:

1. `git fetch --tags`, comprueba que la etiqueta existe y que el árbol está limpio, y hace `git checkout` de la etiqueta.
2. Construye `jds_app:vX.Y.Z` y `jds_tools:vX.Y.Z` (con el commit en la etiqueta de la imagen).
3. **Respaldo antes de migrar** (BD + fotos, con `scripts/backup.sh` dentro del contenedor `tools`). **Sin respaldo no se migra.** El identificador queda en `status.sh`.
4. `prisma migrate deploy` (servicio `migrate`, solo con la BD sana).
5. Levanta `app` y `proxy` con la imagen nueva y espera hasta `JDS_HEALTH_TIMEOUT` (150 s) a que `app` esté `healthy` y `/api/health` responda sano.
6. Si está sana: **precalienta** `/`, `/catalogo` y `/contacto` (la imagen se compila contra una BD efímera y su HTML nace con el catálogo vacío), registra la versión y termina.
7. Si no llega a estar sana: muestra las últimas líneas del log (sin secretos) y **vuelve sola a la imagen anterior**. Sale con código 1 (revertido) o 2 (tampoco la anterior está sana). Las migraciones no se deshacen.

Todos los scripts aceptan `--dry-run` (imprimen lo que harían) y **ninguno ejecuta órdenes destructivas** (`down -v`, `rm -rf`, `prune`, borrado de volúmenes o contenedores): una prueba automática lo vigila.

## Volver atrás

```bash
scripts/deploy/rollback.sh              # a la versión anterior registrada
scripts/deploy/rollback.sh vX.Y.Z       # a otra cuya imagen siga en el servidor
```

Solo cambia la imagen de `app`. Si la versión que se abandona aplicó migraciones, estas **permanecen**: por eso deben ser compatibles hacia atrás.

### Migraciones compatibles hacia atrás (dos pasos)

La versión N-1 debe poder funcionar con el esquema de la versión N. Un cambio destructivo se hace en dos despliegues:

1. **Expandir:** añadir la columna/tabla nueva (con valor por defecto o nula); el código nuevo la usa y sigue escribiendo lo antiguo.
2. **Contraer** (versión posterior, cuando ya no haya vuelta atrás a la anterior): retirar lo antiguo.

Nunca renombrar ni borrar columnas en el mismo despliegue que deja de usarlas. `migrate dev` y `db push` están prohibidos en producción.

### Restaurar datos (solo a mano)

`rollback.sh` no restaura datos. Para volver al estado de un respaldo (p. ej. el que indica `status.sh` como último previo a migrar):

```bash
C="docker compose --env-file $JDS_ENV_FILE -f docker-compose.prod.yml"
JDS_VERSION=<actual> $C run --rm tools bash scripts/restore.sh AAAAMMDD-HHMMSS
```

Pide escribir `RESTAURAR` y **reemplaza** la base de datos y mueve las fotos actuales a una carpeta `.antes-<fecha>`. Parar `app` antes (`docker compose ... stop app`) y volver a levantarla después.

## Estado y logs

```bash
scripts/deploy/status.sh                       # versión, contenedores, salud, imágenes y últimas líneas de log
scripts/deploy/logs.sh [app|db|proxy|migrate] [--tail N] [--follow]
```

Ambos enmascaran URLs de BD, contraseñas, secretos, tokens y cookies. Aun así, no pegues logs completos en canales públicos.

## Si se pierde el acceso

- **Por SSH:** la consola de Oracle Cloud (instancia → _Console connection_ / acceso a la consola serie) permite recuperar el acceso; revisa que la lista de seguridad siga permitiendo el 22. No hay `ufw` que lo impida.
- **Al sitio (443):** comprueba la regla de entrada del 443 en la lista de seguridad y `docker compose ... ps` (el proxy debe estar `Up`). Por IP, el navegador avisará del certificado hasta instalar la CA interna (ver `PROXY.md`).
- **Al panel:** otro ADMIN restablece la clave desde «Usuarios»; si no queda ninguno, `docker compose ... run --rm tools pnpm admin:crear` solo crea el primero y se niega si ya existe uno (en ese caso hay que activar/cambiar el rol directamente en la base de datos, con un respaldo previo).
- **La app no arranca tras un cambio:** `scripts/deploy/rollback.sh`, y revisa `logs.sh app`. Si falla el entorno, el mensaje nombra la variable y la regla, nunca el valor.

## Pruebas del ciclo (local, antes de usar el servidor)

El ciclo v1 → v2 → v3 con la salud rota → vuelta automática se probó en local con Docker (ver las notas de entrega de F6-04): se
construye un repositorio temporal con tres etiquetas, se despliega cada una con `deploy.sh` y se comprueba que la tercera
(cuyo `/api/health/live` responde 500) vuelve sola a la segunda, con los datos y las fotos intactos y un respaldo previo por cada intento.
