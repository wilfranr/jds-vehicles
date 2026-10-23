#!/usr/bin/env bash
# Respaldo de JDS Vehículos (F5-03): base de datos (mysqldump comprimido) + carpeta de subidas (tar.gz).
#
#   scripts/backup.sh [--env-file RUTA]
#
# Variables (entorno o .env): DATABASE_URL, UPLOADS_DIR (por defecto ./uploads),
#   BACKUP_DIR (por defecto ./backups), BACKUP_RETENTION (cantidad de respaldos que se conservan; por defecto 14).
# Genera, con permisos 0600, en BACKUP_DIR:
#   jds-AAAAMMDD-HHMMSS-db.sql.gz   jds-AAAAMMDD-HHMMSS-uploads.tar.gz   jds-AAAAMMDD-HHMMSS.sha256
# La contraseña de la BD NUNCA va en la línea de comandos (se usa un archivo de opciones temporal 0600).
set -euo pipefail
umask 077

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/lib-db.sh
source "$SCRIPT_DIR/lib-db.sh"

ENV_FILE="./.env"
if [[ "${1:-}" == "--env-file" ]]; then ENV_FILE="${2:?Falta la ruta tras --env-file}"; fi

load_config "$ENV_FILE"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION="${BACKUP_RETENTION:-14}"
if [[ ! "$RETENTION" =~ ^[1-9][0-9]*$ ]]; then echo "BACKUP_RETENTION debe ser un entero positivo." >&2; exit 1; fi

DUMP="$(pick_tool mysqldump mariadb-dump)"
STAMP="$(date +%Y%m%d-%H%M%S)"
PREFIX="jds-${STAMP}"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
BACKUP_DIR="$(cd "$BACKUP_DIR" && pwd)"

DEFAULTS="$(make_defaults_file)"
PARTIAL_DB="$BACKUP_DIR/${PREFIX}-db.sql.gz.partial"
PARTIAL_UP="$BACKUP_DIR/${PREFIX}-uploads.tar.gz.partial"
cleanup() { rm -f "$DEFAULTS" "$PARTIAL_DB" "$PARTIAL_UP"; }
trap cleanup EXIT

echo "Respaldando la base de datos «${DB_NAME}»…"
"$DUMP" --defaults-extra-file="$DEFAULTS" \
  --single-transaction --routines --triggers --events \
  --default-character-set=utf8mb4 "$DB_NAME" | gzip -9 > "$PARTIAL_DB"
# `pipefail` hace fallar el script si mysqldump falla; además se comprueba que el volcado esté completo.
if ! gzip -t "$PARTIAL_DB" || ! gzip -dc "$PARTIAL_DB" | tail -n 5 | grep -q "Dump completed"; then
  echo "El volcado de la base de datos está incompleto." >&2
  exit 1
fi

echo "Respaldando la carpeta de subidas…"
if [[ -d "$UPLOADS_DIR" ]]; then
  tar -C "$(dirname "$UPLOADS_DIR")" -czf "$PARTIAL_UP" "$(basename "$UPLOADS_DIR")"
else
  echo "  (la carpeta de subidas no existe: se guarda un archivo vacío)"
  tar -czf "$PARTIAL_UP" -T /dev/null
fi

mv "$PARTIAL_DB" "$BACKUP_DIR/${PREFIX}-db.sql.gz"
mv "$PARTIAL_UP" "$BACKUP_DIR/${PREFIX}-uploads.tar.gz"
( cd "$BACKUP_DIR" && sha256sum "${PREFIX}-db.sql.gz" "${PREFIX}-uploads.tar.gz" > "${PREFIX}.sha256" )
chmod 600 "$BACKUP_DIR/${PREFIX}"-*.gz "$BACKUP_DIR/${PREFIX}.sha256"

# Retención: se conservan los N respaldos más recientes (por la marca de fecha del nombre).
mapfile -t SETS < <(cd "$BACKUP_DIR" && ls -1 jds-*.sha256 2>/dev/null | sort -r)
if (( ${#SETS[@]} > RETENTION )); then
  for old in "${SETS[@]:RETENTION}"; do
    base="${old%.sha256}"
    rm -f "$BACKUP_DIR/${base}-db.sql.gz" "$BACKUP_DIR/${base}-uploads.tar.gz" "$BACKUP_DIR/${base}.sha256"
    echo "Retención: eliminado el respaldo ${base}"
  done
fi

echo "Respaldo listo: ${BACKUP_DIR}/${PREFIX}  ($(du -h "$BACKUP_DIR/${PREFIX}-db.sql.gz" | cut -f1) de BD, $(du -h "$BACKUP_DIR/${PREFIX}-uploads.tar.gz" | cut -f1) de fotos)"
