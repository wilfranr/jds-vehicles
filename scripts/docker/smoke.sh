#!/usr/bin/env bash
# Prueba de humo de la imagen de producción (F6-02). La usan el CI y las pruebas locales; NO toca el servidor real.
#   scripts/docker/smoke.sh <archivo-de-entorno> [--keep]
# Levanta db → migrate → app con el archivo de entorno indicado (de PRUEBA), verifica la imagen y el stack y, salvo
# --keep, lo destruye al terminar (incluidos los volúmenes jds_* de esta ejecución: usa un proyecto de nombre propio).
set -euo pipefail

ENV_FILE="${1:?uso: smoke.sh <archivo-de-entorno> [--keep]}"
KEEP="${2:-}"
[[ -f "$ENV_FILE" ]] || { echo "No existe $ENV_FILE" >&2; exit 1; }

# Proyecto y volúmenes propios: una ejecución de humo nunca toca los volúmenes `jds_*` reales.
export JDS_ENV_FILE="$ENV_FILE"
export JDS_VERSION="smoke"
PORT="${SMOKE_PORT:-3399}"
OVERRIDE="$(mktemp)"
cat >"$OVERRIDE" <<YAML
services:
  app:
    container_name: jds_smoke_app
    ports: ['127.0.0.1:${PORT}:3000']
  db:
    container_name: jds_smoke_db
  migrate:
    container_name: jds_smoke_migrate
  tools:
    container_name: jds_smoke_tools
networks:
  internal:
    name: jds_smoke_internal
volumes:
  jds_mysql_data:
    name: jds_smoke_mysql_data
  jds_uploads:
    name: jds_smoke_uploads
  jds_backups:
    name: jds_smoke_backups
YAML
compose() { docker compose -p jds_smoke --env-file "$ENV_FILE" -f docker-compose.prod.yml -f "$OVERRIDE" "$@"; }

cleanup() {
  rm -f "$OVERRIDE"
  if [[ "$KEEP" != "--keep" ]]; then
    # Solo el proyecto `jds_smoke` (volúmenes jds_smoke_*): nunca el proyecto `jds` real.
    docker compose -p jds_smoke down -v --remove-orphans >/dev/null 2>&1 || true
  fi
}
fail() { echo "FALLO: $*" >&2; compose logs --tail=40 app 2>&1 | sed -E 's/(secret|password)=[^ ]+/\1=***/Ig' >&2 || true; exit 1; }
ok() { echo "  ok  $*"; }

echo "== Construyendo imágenes (app y tools)"
compose build app migrate

echo "== Levantando db → migrate → app"
compose up -d
trap cleanup EXIT

for _ in $(seq 1 60); do
  [[ "$(docker inspect -f '{{.State.Health.Status}}' jds_smoke_app 2>/dev/null || true)" == "healthy" ]] && break
  sleep 2
done
[[ "$(docker inspect -f '{{.State.Health.Status}}' jds_smoke_app)" == "healthy" ]] || fail "la app no llegó a «healthy»"
ok "el HEALTHCHECK de la imagen pasa"

[[ "$(docker inspect -f '{{.State.ExitCode}}' jds_smoke_migrate)" == "0" ]] || fail "migrate no terminó con éxito"
ok "migrate terminó con éxito (BD sana antes de migrar)"

[[ "$(docker exec jds_smoke_app id -u)" != "0" ]] || fail "la app corre como root"
ok "la app corre como usuario no root (uid $(docker exec jds_smoke_app id -u))"

docker exec jds_smoke_app sh -c 'touch /app/prueba 2>/dev/null' && fail "el sistema de archivos de la app no es de solo lectura"
ok "sistema de archivos de solo lectura (salvo uploads, /tmp y caché de Next)"

[[ "$(docker inspect -f '{{json .HostConfig.PortBindings}}' jds_smoke_db)" == "{}" ]] || fail "db publica puertos"
ok "db no publica ningún puerto"

HEALTH="$(curl -fsS "http://127.0.0.1:${PORT}/api/health")" || fail "/api/health no responde"
[[ "$HEALTH" == *'"status":"ok"'* && "$HEALTH" == *'"db":"up"'* ]] || fail "/api/health no está sano"
ok "/api/health: $HEALTH"
curl -fsS -o /dev/null "http://127.0.0.1:${PORT}/" || fail "la portada no responde"
ok "la portada responde"

# Secretos e historial fuera de la imagen.
LEAKS="$(docker run --rm --entrypoint sh jds_app:smoke -c 'find / -xdev \( -name ".env" -o -name ".env.*" -o -name ".git" -o -name "id_rsa*" -o -name "*.key" \) -not -path "*/node_modules/*" -not -path "/proc/*" 2>/dev/null' || true)"
[[ -z "$LEAKS" ]] || fail "la imagen contiene archivos sensibles: $LEAKS"
ok "la imagen no contiene .env, .git ni llaves"
for secret_var in MYSQL_ROOT_PASSWORD MYSQL_PASSWORD AUTH_SECRET DATABASE_URL; do
  docker image inspect jds_app:smoke --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -q "^${secret_var}=" && fail "la imagen incorpora ${secret_var}"
done
ok "ningún secreto en el entorno de la imagen"

# Persistencia de las fotos al recrear la app.
docker exec jds_smoke_app sh -c 'echo persistente > /data/uploads/humo.txt'
compose up -d --force-recreate --no-deps app >/dev/null
for _ in $(seq 1 60); do
  [[ "$(docker inspect -f '{{.State.Health.Status}}' jds_smoke_app 2>/dev/null || true)" == "healthy" ]] && break
  sleep 2
done
[[ "$(docker exec jds_smoke_app cat /data/uploads/humo.txt)" == "persistente" ]] || fail "recrear la app perdió los archivos"
ok "recrear la app conserva los archivos del volumen"

echo "== Imágenes"
docker image ls --format '  {{.Repository}}:{{.Tag}}  {{.Size}}' | grep -E 'jds_(app|tools):smoke'
echo "HUMO OK"
