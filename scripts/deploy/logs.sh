#!/usr/bin/env bash
# Logs de un servicio (F6-04) con los secretos enmascarados. Solo lectura.
#   JDS_ENV_FILE=/ruta/segura/.env.prod scripts/deploy/logs.sh [app|db|proxy|migrate] [--tail N] [--follow]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/../.."
# shellcheck source=scripts/deploy/lib.sh
source "$SCRIPT_DIR/lib.sh"

SERVICE="app"; TAIL="100"; FOLLOW=()
args=("$@")
i=0
while (( i < ${#args[@]} )); do
  case "${args[$i]}" in
    app|db|proxy|migrate) SERVICE="${args[$i]}" ;;
    --tail) i=$((i + 1)); TAIL="${args[$i]:?Falta el número tras --tail}" ;;
    --follow) FOLLOW=(--follow) ;;
    --dry-run) DRY_RUN=1 ;;
    *) die "Argumento no reconocido: ${args[$i]}" ;;
  esac
  i=$((i + 1))
done
[[ "$TAIL" =~ ^[0-9]+$ ]] || die "--tail debe ser un número."
init_config
if [[ "$DRY_RUN" == "1" ]]; then log "+ (simulado) docker compose logs --tail=${TAIL} ${FOLLOW[*]:-} ${SERVICE} | redact"; exit 0; fi
compose logs --no-color --tail="$TAIL" "${FOLLOW[@]}" "$SERVICE" 2>&1 | redact
