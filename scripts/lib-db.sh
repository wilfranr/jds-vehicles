# shellcheck shell=bash
# Utilidades comunes de backup.sh / restore.sh / verify-backup-cycle.sh (se cargan con `source`).
# No imprimen contraseñas ni las pasan en la línea de comandos: usan un archivo de opciones temporal (0600).

# Decodifica %XX de una URL (las contraseñas de DATABASE_URL pueden ir codificadas).
urldecode() {
  local data="${1//+/ }"
  printf '%b' "${data//%/\\x}"
}

# Lee UNA variable de un archivo .env sin ejecutarlo (sin `source`: los valores pueden tener caracteres especiales).
env_from_file() {
  local file="$1" key="$2" line value
  [[ -f "$file" ]] || return 1
  line="$(grep -E "^${key}=" "$file" | tail -n 1 || true)"
  [[ -n "$line" ]] || return 1
  value="${line#*=}"
  value="${value%\"}"; value="${value#\"}"
  value="${value%\'}"; value="${value#\'}"
  printf '%s' "$value"
}

# Carga DATABASE_URL y UPLOADS_DIR desde el entorno o, si faltan, desde el archivo indicado (por defecto ./.env).
load_config() {
  local file="${1:-./.env}"
  if [[ -z "${DATABASE_URL:-}" ]]; then DATABASE_URL="$(env_from_file "$file" DATABASE_URL || true)"; fi
  if [[ -z "${UPLOADS_DIR:-}" ]]; then UPLOADS_DIR="$(env_from_file "$file" UPLOADS_DIR || true)"; fi
  UPLOADS_DIR="${UPLOADS_DIR:-./uploads}"
  if [[ -z "${DATABASE_URL:-}" ]]; then
    echo "Falta DATABASE_URL (en el entorno o en $file)." >&2
    return 1
  fi
  parse_database_url "$DATABASE_URL"
}

# DATABASE_URL=mysql://usuario:clave@host:puerto/base  ->  DB_USER DB_PASSWORD DB_HOST DB_PORT DB_NAME
parse_database_url() {
  local url="$1"
  local re='^mysql://([^:@/]+)(:([^@]*))?@([^:/]+)(:([0-9]+))?/([^?]+)'
  if [[ ! "$url" =~ $re ]]; then
    echo "DATABASE_URL no tiene el formato mysql://usuario:clave@host:puerto/base." >&2
    return 1
  fi
  DB_USER="$(urldecode "${BASH_REMATCH[1]}")"
  DB_PASSWORD="$(urldecode "${BASH_REMATCH[3]:-}")"
  DB_HOST="${BASH_REMATCH[4]}"
  DB_PORT="${BASH_REMATCH[6]:-3306}"
  DB_NAME="${BASH_REMATCH[7]}"
}

# Crea el archivo de opciones del cliente MySQL (0600) y devuelve su ruta; el llamador lo borra con `trap`.
make_defaults_file() {
  local file
  file="$(mktemp)"
  chmod 600 "$file"
  {
    echo '[client]'
    echo "user=\"${DB_USER}\""
    local escaped="${DB_PASSWORD//\\/\\\\}"
    escaped="${escaped//\"/\\\"}"
    echo "password=\"${escaped}\""
    echo "protocol=tcp"
    # DB_CLIENT_SSL=off: servidor local con certificado autofirmado (el cliente MariaDB exige verificarlo).
    if [[ "${DB_CLIENT_SSL:-}" == "off" ]]; then echo "skip-ssl"; fi
    echo "host=${DB_HOST}"
    echo "port=${DB_PORT}"
  } > "$file"
  printf '%s' "$file"
}

# Comando del cliente de MySQL/MariaDB disponible (el nombre `mysql` está obsoleto en MariaDB).
pick_tool() {
  local primary="$1" alternative="$2"
  if command -v "$primary" >/dev/null 2>&1; then printf '%s' "$primary"
  elif command -v "$alternative" >/dev/null 2>&1; then printf '%s' "$alternative"
  else echo "No se encontró $primary ni $alternative en el PATH." >&2; return 1
  fi
}
