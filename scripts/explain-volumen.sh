#!/usr/bin/env bash
# Evalúa los planes de consulta con volumen sintético (F5-03), en una BASE TEMPORAL que se elimina al terminar:
#   scripts/explain-volumen.sh [salida.txt]
# Variable opcional EXTRA_SQL=archivo.sql: se ejecuta tras cargar los datos (para probar índices candidatos).
# Aplica las migraciones actuales, carga ~50 000 usuarios y vehículos, 200 000 reservas y 12 000 ventas, y ejecuta
# scripts/sql/explain-queries.sql. Para comparar antes/después de un índice, ejecútalo en cada rama y compara salidas.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
# shellcheck source=scripts/lib-db.sh
source "$SCRIPT_DIR/lib-db.sh"
cd "$ROOT"
load_config ./.env
if [[ -z "${DB_CLIENT_SSL:-}" && ( "$DB_HOST" == "localhost" || "$DB_HOST" == "127.0.0.1" ) ]]; then export DB_CLIENT_SSL=off; fi
OUT="${1:-/dev/stdout}"
DEFAULTS="$(make_defaults_file)"
CLIENT="$(pick_tool mysql mariadb)"
BASE_URL="${DATABASE_URL%%\?*}"; BASE_URL="${BASE_URL%/*}"
TEMP_DB="jds_explain_test_$(od -An -N5 -tx1 /dev/urandom | tr -d ' \n')"
trap '"$CLIENT" --defaults-extra-file="$DEFAULTS" -e "DROP DATABASE IF EXISTS \`${TEMP_DB}\`" 2>/dev/null || true; rm -f "$DEFAULTS"' EXIT

"$CLIENT" --defaults-extra-file="$DEFAULTS" -e "CREATE DATABASE \`${TEMP_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
quiet() { local out; if ! out="$("$@" 2>&1)"; then echo "$out" >&2; return 1; fi; }
DATABASE_URL="${BASE_URL}/${TEMP_DB}" quiet pnpm -s prisma migrate deploy
DATABASE_URL="${BASE_URL}/${TEMP_DB}" quiet pnpm -s db:seed
"$CLIENT" --defaults-extra-file="$DEFAULTS" --default-character-set=utf8mb4 "$TEMP_DB" < "$SCRIPT_DIR/sql/volumen-sintetico.sql"
if [[ -n "${EXTRA_SQL:-}" ]]; then
  "$CLIENT" --defaults-extra-file="$DEFAULTS" --default-character-set=utf8mb4 "$TEMP_DB" < "$EXTRA_SQL" >/dev/null
fi
{
  "$CLIENT" --defaults-extra-file="$DEFAULTS" --default-character-set=utf8mb4 -t "$TEMP_DB" -e \
    "SELECT 'usuarios' t, COUNT(*) filas FROM usuarios UNION ALL SELECT 'vehiculos', COUNT(*) FROM vehiculos UNION ALL SELECT 'reservas', COUNT(*) FROM reservas UNION ALL SELECT 'ventas', COUNT(*) FROM ventas"
  "$CLIENT" --defaults-extra-file="$DEFAULTS" --default-character-set=utf8mb4 -t "$TEMP_DB" < "$SCRIPT_DIR/sql/explain-queries.sql"
  "$CLIENT" --defaults-extra-file="$DEFAULTS" --default-character-set=utf8mb4 -B -N "$TEMP_DB" < "$SCRIPT_DIR/sql/analyze-queries.sql" | sed 's/^-> /  -> /; s/\\n/\n/g'
} > "$OUT"
