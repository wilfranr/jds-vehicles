#!/usr/bin/env bash
# Prueba el ciclo completo respaldar → destruir → restaurar contra una BASE DE DATOS TEMPORAL (F5-03).
#
#   pnpm backup:verificar          (necesita DATABASE_URL de un servidor donde se pueda crear una base de datos)
#
# NUNCA toca la base de datos de DATABASE_URL: crea «jds_backup_test_<aleatorio>» en el mismo servidor, le aplica
# las migraciones, la siembra, añade filas con tildes y fotos de prueba, hace el respaldo, DESTRUYE la base y la
# carpeta de fotos, restaura, compara tabla por tabla (CHECKSUM TABLE) y archivo por archivo (SHA-256) y borra todo.
set -euo pipefail
umask 077

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
# shellcheck source=scripts/lib-db.sh
source "$SCRIPT_DIR/lib-db.sh"
cd "$ROOT"

load_config "${1:-./.env}"
# Servidor local (desarrollo): certificado autofirmado, se desactiva TLS del cliente solo para esta prueba.
if [[ -z "${DB_CLIENT_SSL:-}" && ( "$DB_HOST" == "localhost" || "$DB_HOST" == "127.0.0.1" ) ]]; then export DB_CLIENT_SSL=off; fi
BASE_URL="${DATABASE_URL%%\?*}"
BASE_URL="${BASE_URL%/*}"
ADMIN_DEFAULTS="$(make_defaults_file)"
CLIENT="$(pick_tool mysql mariadb)"

TEMP_DB="jds_backup_test_$(od -An -N5 -tx1 /dev/urandom | tr -d ' \n')"
WORK="$(mktemp -d)"
TEMP_URL="${BASE_URL}/${TEMP_DB}"
UPLOADS="$WORK/uploads"
BACKUPS="$WORK/backups"

cleanup() {
  "$CLIENT" --defaults-extra-file="$ADMIN_DEFAULTS" -e "DROP DATABASE IF EXISTS \`${TEMP_DB}\`" 2>/dev/null || true
  rm -rf "$WORK" "$ADMIN_DEFAULTS"
}
trap cleanup EXIT

# Ejecuta un comando en silencio y muestra su salida solo si falla.
quiet() { local out; if ! out="$("$@" 2>&1)"; then echo "$out" >&2; return 1; fi; }

sql() { "$CLIENT" --defaults-extra-file="$ADMIN_DEFAULTS" --default-character-set=utf8mb4 -N -B "$@"; }

echo "== 1. Base de datos temporal ${TEMP_DB} (la base real «${DB_NAME}» no se toca)"
sql -e "CREATE DATABASE \`${TEMP_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
DATABASE_URL="$TEMP_URL" quiet pnpm -s prisma migrate deploy
DATABASE_URL="$TEMP_URL" quiet pnpm -s db:seed

echo "== 2. Datos de prueba: filas con tildes y fotos de prueba"
sql "$TEMP_DB" -e "UPDATE usuarios SET ciudad='Bogotá D.C. — Ñandú ü' WHERE email='carlos.gomez@example.com'"
mkdir -p "$UPLOADS/sub"
head -c 20000 /dev/urandom > "$UPLOADS/3f2b8c1e-9d4a-4b7e-8a61-0c5d2e7f9a10.webp"
head -c 5000 /dev/urandom > "$UPLOADS/3f2b8c1e-9d4a-4b7e-8a61-0c5d2e7f9a10_t.webp"
head -c 1234 /dev/urandom > "$UPLOADS/sub/otra.webp"

TABLES="$(sql "$TEMP_DB" -e "SELECT table_name FROM information_schema.tables WHERE table_schema='${TEMP_DB}' AND table_name <> '_prisma_migrations' ORDER BY table_name")"
snapshot() {
  for t in $TABLES; do
    printf '%s rows=%s checksum=%s\n' "$t" \
      "$(sql "$TEMP_DB" -e "SELECT COUNT(*) FROM \`$t\`")" \
      "$(sql "$TEMP_DB" -e "CHECKSUM TABLE \`$t\`" | cut -f2)"
  done
}
files_snapshot() { ( cd "$UPLOADS" && find . -type f -exec sha256sum {} + | sort -k2 ); }

snapshot > "$WORK/before.txt"
files_snapshot > "$WORK/files-before.txt"
echo "   $(wc -l < "$WORK/before.txt") tablas, $(wc -l < "$WORK/files-before.txt") archivos de fotos"
awk '{print "   " $0}' "$WORK/before.txt" | grep -E "usuarios|vehiculos|reservas|vehiculo_fotos|marcas" || true

echo "== 3. Respaldar"
DATABASE_URL="$TEMP_URL" UPLOADS_DIR="$UPLOADS" BACKUP_DIR="$BACKUPS" "$SCRIPT_DIR/backup.sh" --env-file /dev/null
STAMP="$(cd "$BACKUPS" && ls -1 jds-*.sha256 | head -n 1 | sed 's/^jds-//; s/\.sha256$//')"
for f in "$BACKUPS"/jds-*; do
  [[ "$(stat -c '%a' "$f")" == "600" ]] || { echo "Permisos inesperados en $(basename "$f")" >&2; exit 1; }
done
[[ "$(stat -c '%a' "$BACKUPS")" == "700" ]] || { echo "La carpeta de respaldos debe ser 0700" >&2; exit 1; }
echo "   Permisos: archivos 0600, carpeta 0700."

echo "== 4. DESTRUIR la base temporal y la carpeta de fotos"
sql -e "DROP DATABASE \`${TEMP_DB}\`"
rm -rf "$UPLOADS"
[[ -z "$(sql -e "SHOW DATABASES LIKE '${TEMP_DB}'")" ]] || { echo "La base no se eliminó" >&2; exit 1; }
[[ ! -e "$UPLOADS" ]] || { echo "La carpeta no se eliminó" >&2; exit 1; }

echo "== 5. Garantías de la restauración (antes de restaurar de verdad)"
if echo "no" | DATABASE_URL="$TEMP_URL" UPLOADS_DIR="$UPLOADS" BACKUP_DIR="$BACKUPS" "$SCRIPT_DIR/restore.sh" "$STAMP" --env-file /dev/null >/dev/null 2>&1; then
  echo "Sin confirmar «RESTAURAR» no debe restaurar" >&2; exit 1
fi
[[ -z "$(sql -e "SHOW DATABASES LIKE '${TEMP_DB}'")" ]] || { echo "Se restauró sin confirmación" >&2; exit 1; }
echo "   Sin escribir RESTAURAR: cancelado y sin cambios."
mkdir -p "$WORK/tampered"
cp "$BACKUPS"/jds-* "$WORK/tampered/"
printf 'X' | dd of="$(ls "$WORK"/tampered/jds-*-db.sql.gz | head -n 1)" bs=1 seek=40 conv=notrunc 2>/dev/null
if DATABASE_URL="$TEMP_URL" UPLOADS_DIR="$UPLOADS" BACKUP_DIR="$WORK/tampered" "$SCRIPT_DIR/restore.sh" "$STAMP" --yes --env-file /dev/null >/dev/null 2>&1; then
  echo "Un respaldo alterado no debe restaurarse" >&2; exit 1
fi
[[ -z "$(sql -e "SHOW DATABASES LIKE '${TEMP_DB}'")" ]] || { echo "Se restauró un respaldo alterado" >&2; exit 1; }
echo "   Respaldo alterado: rechazado por la suma SHA-256, sin cambios."

echo "== 5b. Restaurar"
DATABASE_URL="$TEMP_URL" UPLOADS_DIR="$UPLOADS" BACKUP_DIR="$BACKUPS" "$SCRIPT_DIR/restore.sh" "$STAMP" --yes --env-file /dev/null

echo "== 6. Comparar"
snapshot > "$WORK/after.txt"
files_snapshot > "$WORK/files-after.txt"
if diff -u "$WORK/before.txt" "$WORK/after.txt" && diff -u "$WORK/files-before.txt" "$WORK/files-after.txt"; then
  echo "   Tablas (conteo y CHECKSUM): idénticas.  Fotos (SHA-256): idénticas."
else
  echo "El ciclo NO recuperó exactamente los datos." >&2
  exit 1
fi
CITY="$(sql "$TEMP_DB" -e "SELECT ciudad FROM usuarios WHERE email='carlos.gomez@example.com'")"
[[ "$CITY" == 'Bogotá D.C. — Ñandú ü' ]] || { echo "Los caracteres especiales no se recuperaron" >&2; exit 1; }
echo "   Caracteres especiales: intactos."

echo "== 7. Retención (BACKUP_RETENTION=2 con 4 respaldos)"
for i in 1 2 3; do
  sleep 1
  DATABASE_URL="$TEMP_URL" UPLOADS_DIR="$UPLOADS" BACKUP_DIR="$BACKUPS" BACKUP_RETENTION=2 "$SCRIPT_DIR/backup.sh" --env-file /dev/null >/dev/null
done
KEPT="$(ls -1 "$BACKUPS"/jds-*.sha256 | wc -l)"
[[ "$KEPT" == 2 ]] || { echo "La retención dejó $KEPT respaldos en lugar de 2" >&2; exit 1; }
echo "   Respaldos conservados: $KEPT."

echo
echo "CICLO OK: respaldar → destruir → restaurar recuperó exactamente los datos y las fotos."
