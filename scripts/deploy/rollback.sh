#!/usr/bin/env bash
# Vuelve a una versión ya construida en este servidor (F6-04). Por defecto, la anterior a la actual.
#
#   JDS_ENV_FILE=/ruta/segura/.env.prod scripts/deploy/rollback.sh [vX.Y.Z] [--dry-run]
#
# Solo cambia la imagen de la aplicación: NO deshace migraciones ni restaura datos (para eso, scripts/restore.sh a mano
# con el respaldo indicado en `status.sh`, con su confirmación explícita).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/../.."
# shellcheck source=scripts/deploy/lib.sh
source "$SCRIPT_DIR/lib.sh"

parse_common_flags "$@"
init_config
CURRENT="$(state_get current)"
TARGET="${POSITIONAL[0]:-$(state_get previous)}"
[[ -n "$TARGET" ]] || die "No hay versión anterior registrada: indica una (rollback.sh vX.Y.Z)."
valid_tag "$TARGET" || die "La etiqueta debe tener el formato vMAJOR.MINOR.PATCH."
[[ "$TARGET" != "$CURRENT" ]] || die "${TARGET} ya es la versión actual."
if [[ "$DRY_RUN" != "1" ]]; then
  image_exists "jds_app:${TARGET}" || die "No existe la imagen jds_app:${TARGET} en este servidor (desplegarla con deploy.sh)."
fi

[[ "$DRY_RUN" == "1" ]] && log "== SIMULACIÓN (--dry-run): no se modifica nada =="
log "Volviendo de ${CURRENT:-?} a ${TARGET}"
export JDS_VERSION="$TARGET"
run compose up -d --no-build --force-recreate app proxy || log "docker compose up terminó con error: se comprueba la salud."

if wait_healthy; then
  warm_up
  state_set previous "${CURRENT}"
  state_set current "$TARGET"
  if [[ "$DRY_RUN" != "1" ]]; then
    state_set commit "$(docker image inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' "jds_app:${TARGET}" 2>/dev/null || true)"
  fi
  log "OK: ${TARGET} en marcha. Las migraciones no se deshicieron; último respaldo: $(state_get last_backup)."
else
  die "${TARGET} no llegó a estar sana. Revisa scripts/deploy/logs.sh."
fi
