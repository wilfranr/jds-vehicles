#!/usr/bin/env bash
# Restauración de un respaldo de JDS Vehículos (F5-03). DESTRUCTIVA: reemplaza las tablas de la base de datos
# de DATABASE_URL y la carpeta de subidas.
#
#   scripts/restore.sh AAAAMMDD-HHMMSS [--yes] [--env-file RUTA]
#
# Sin --yes pide escribir exactamente RESTAURAR. Antes de tocar nada verifica las sumas SHA-256. La carpeta de
# subidas actual NO se borra: se mueve a «<UPLOADS_DIR>.antes-<fecha>». Variables: DATABASE_URL, UPLOADS_DIR,
# BACKUP_DIR (por defecto ./backups).
set -euo pipefail
umask 077

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/lib-db.sh
source "$SCRIPT_DIR/lib-db.sh"

STAMP="${1:-}"
if [[ ! "$STAMP" =~ ^[0-9]{8}-[0-9]{6}$ ]]; then
  echo "Uso: scripts/restore.sh AAAAMMDD-HHMMSS [--yes] [--env-file RUTA]" >&2
  exit 1
fi
shift
ASSUME_YES=0
ENV_FILE="./.env"
while (( $# > 0 )); do
  case "$1" in
    --yes) ASSUME_YES=1 ;;
    --env-file) ENV_FILE="${2:?Falta la ruta tras --env-file}"; shift ;;
    *) echo "Opción desconocida: $1" >&2; exit 1 ;;
  esac
  shift
done

load_config "$ENV_FILE"
BACKUP_DIR="$(cd "${BACKUP_DIR:-./backups}" && pwd)"
PREFIX="jds-${STAMP}"
DB_FILE="$BACKUP_DIR/${PREFIX}-db.sql.gz"
UP_FILE="$BACKUP_DIR/${PREFIX}-uploads.tar.gz"
SUMS="$BACKUP_DIR/${PREFIX}.sha256"
for f in "$DB_FILE" "$UP_FILE" "$SUMS"; do
  [[ -f "$f" ]] || { echo "No existe el archivo del respaldo: $(basename "$f")" >&2; exit 1; }
done

echo "Verificando sumas SHA-256…"
( cd "$BACKUP_DIR" && sha256sum --check --quiet "${PREFIX}.sha256" ) || { echo "El respaldo está dañado: no se restaura nada." >&2; exit 1; }

echo
echo "Se va a RESTAURAR el respaldo ${STAMP}:"
echo "  - Base de datos «${DB_NAME}» en ${DB_HOST}:${DB_PORT}: se reemplazan sus tablas."
echo "  - Carpeta de subidas «${UPLOADS_DIR}»: se mueve a «${UPLOADS_DIR}.antes-<fecha>» y se sustituye."
if (( ASSUME_YES == 0 )); then
  read -r -p 'Escribe RESTAURAR para continuar: ' answer
  [[ "$answer" == "RESTAURAR" ]] || { echo "Cancelado." ; exit 1; }
fi

CLIENT="$(pick_tool mysql mariadb)"
DEFAULTS="$(make_defaults_file)"
TMP_UP="$(mktemp -d)"
cleanup() { rm -f "$DEFAULTS"; rm -rf "$TMP_UP"; }
trap cleanup EXIT

# La base de datos puede no existir (servidor nuevo): se intenta crearla; si no hay permiso, debe existir ya.
"$CLIENT" --defaults-extra-file="$DEFAULTS" -e "CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci" 2>/dev/null || true

echo "Restaurando la base de datos…"
gzip -dc "$DB_FILE" | "$CLIENT" --defaults-extra-file="$DEFAULTS" --default-character-set=utf8mb4 "$DB_NAME"

echo "Restaurando la carpeta de subidas…"
tar -xzf "$UP_FILE" -C "$TMP_UP"
shopt -s nullglob dotglob
extracted=("$TMP_UP"/*)
shopt -u nullglob dotglob
if [[ -e "$UPLOADS_DIR" ]]; then
  mv "$UPLOADS_DIR" "${UPLOADS_DIR}.antes-$(date +%Y%m%d-%H%M%S)"
fi
mkdir -p "$(dirname "$UPLOADS_DIR")"
if (( ${#extracted[@]} == 1 )) && [[ -d "${extracted[0]}" ]]; then
  mv "${extracted[0]}" "$UPLOADS_DIR"
else
  mkdir -p "$UPLOADS_DIR"
fi
chmod 750 "$UPLOADS_DIR"

echo "Restauración completa del respaldo ${STAMP}."
