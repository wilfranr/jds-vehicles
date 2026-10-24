# shellcheck shell=bash
# Utilidades comunes de los scripts de despliegue (F6-04). Se cargan con `source`; se ejecutan EN EL SERVIDOR, en la
# raíz del repositorio. Ningún script imprime el archivo de entorno ni las variables secretas, y NINGUNO ejecuta
# órdenes destructivas (`down -v`, `rm -rf`, `prune`, borrado de volúmenes): si hiciera falta una, la hace una
# persona, a mano y con confirmación (ver docs/DESPLIEGUE.md).

DRY_RUN=0
VERBOSE_PREFIX="+"

log() { printf '%s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

# Ejecuta una orden o, con --dry-run, solo la imprime.
run() {
  if [[ "$DRY_RUN" == "1" ]]; then
    if [[ "${1:-}" == "compose" ]]; then
      shift
      printf '%s (simulado) docker compose --env-file <JDS_ENV_FILE> %s %s\n' "$VERBOSE_PREFIX" "$JDS_COMPOSE_FILES" "$*"
    else
      printf '%s (simulado) %s\n' "$VERBOSE_PREFIX" "$*"
    fi
    return 0
  fi
  "$@"
}

# Valores configurables por entorno (las pruebas locales los cambian).
init_config() {
  JDS_ENV_FILE="${JDS_ENV_FILE:-}"
  [[ -n "$JDS_ENV_FILE" ]] || die "Define JDS_ENV_FILE con la ruta del archivo de entorno del servidor (p. ej. /ruta/segura/.env.prod)."
  if [[ "$DRY_RUN" != "1" ]]; then [[ -f "$JDS_ENV_FILE" ]] || die "No existe el archivo de entorno indicado en JDS_ENV_FILE."; fi
  export JDS_ENV_FILE
  # Por defecto: aplicación + proxy. Para otra combinación: JDS_COMPOSE_FILES="-f a.yml -f b.yml".
  JDS_COMPOSE_FILES="${JDS_COMPOSE_FILES:--f docker-compose.prod.yml -f docker-compose.proxy.yml}"
  JDS_STATE_DIR="${JDS_STATE_DIR:-${XDG_STATE_HOME:-$HOME/.local/state}/jds-deploy}"
  JDS_HEALTH_TIMEOUT="${JDS_HEALTH_TIMEOUT:-150}"
  JDS_WARMUP_PATHS="${JDS_WARMUP_PATHS:-/ /catalogo /contacto}"
  APP_CONTAINER="${JDS_APP_CONTAINER:-jds_app}"
}

# docker compose con los archivos y el entorno del servidor (la versión de la imagen sale de $JDS_VERSION).
compose() {
  # shellcheck disable=SC2086
  docker compose --env-file "$JDS_ENV_FILE" $JDS_COMPOSE_FILES "$@"
}

# --- Estado del despliegue (versión actual y anterior) ---------------------------------------------------------------
state_get() { [[ -f "$JDS_STATE_DIR/$1" ]] && cat "$JDS_STATE_DIR/$1" || true; }
state_set() { [[ "$DRY_RUN" == "1" ]] || { umask 077; mkdir -p "$JDS_STATE_DIR"; printf '%s\n' "$2" > "$JDS_STATE_DIR/$1"; }; }

valid_tag() { [[ "$1" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; }

image_exists() { docker image inspect "$1" >/dev/null 2>&1; }

# Espera a que el contenedor de la app esté «healthy» y /api/health responda sano. 0 = sano, 1 = no.
wait_healthy() {
  local deadline=$(( $(date +%s) + JDS_HEALTH_TIMEOUT )) status
  [[ "$DRY_RUN" == "1" ]] && { log "+ (simulado) esperar hasta ${JDS_HEALTH_TIMEOUT}s a que ${APP_CONTAINER} esté sano"; return 0; }
  while (( $(date +%s) < deadline )); do
    status="$(docker inspect -f '{{.State.Health.Status}}' "$APP_CONTAINER" 2>/dev/null || echo ausente)"
    case "$status" in
      healthy)
        if docker exec "$APP_CONTAINER" node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" 2>/dev/null; then
          return 0
        fi ;;
      unhealthy) return 1 ;;
    esac
    # Un contenedor que se reinicia en bucle no se recuperará solo.
    if [[ "$(docker inspect -f '{{.State.Restarting}}' "$APP_CONTAINER" 2>/dev/null || echo false)" == "true" ]]; then return 1; fi
    sleep 3
  done
  return 1
}

# Precalienta las páginas principales dentro de la red (desde la propia app): la imagen se compiló contra una BD
# efímera y su HTML prerenderizado nace con el catálogo vacío; dos pasadas dejan la caché con los datos reales.
warm_up() {
  [[ "$DRY_RUN" == "1" ]] && { log "+ (simulado) precalentar: ${JDS_WARMUP_PATHS}"; return 0; }
  local path pass
  for pass in 1 2; do
    for path in $JDS_WARMUP_PATHS; do
      docker exec "$APP_CONTAINER" node -e "fetch('http://127.0.0.1:3000${path}').then(r=>r.arrayBuffer()).then(()=>process.exit(0)).catch(()=>process.exit(0))" >/dev/null 2>&1 || true
    done
    sleep 2
  done
  log "Páginas precalentadas: ${JDS_WARMUP_PATHS}"
}

# Enmascara cualquier valor que parezca un secreto antes de mostrar logs.
redact() {
  sed -E \
    -e 's#(mysql://[^:/@ ]+:)[^@ ]+@#\1***@#Ig' \
    -e 's#((authorization|cookie)"?[=:] *"?).*#\1***#Ig' \
    -e 's#("?(password|passwd|secret|token|api[-_]?key|hash)[a-z_]*"?[=:] *"?)[^", ]+#\1***#Ig'
}

parse_common_flags() {
  # Reparte --dry-run y deja el resto en POSITIONAL.
  POSITIONAL=()
  local arg
  for arg in "$@"; do
    case "$arg" in
      --dry-run) DRY_RUN=1 ;;
      *) POSITIONAL+=("$arg") ;;
    esac
  done
}
