#!/usr/bin/env bash
# Estado del despliegue (F6-04): versión, contenedores, salud y últimas líneas de log SIN secretos. Solo lectura.
#   JDS_ENV_FILE=/ruta/segura/.env.prod scripts/deploy/status.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/../.."
# shellcheck source=scripts/deploy/lib.sh
source "$SCRIPT_DIR/lib.sh"

parse_common_flags "$@"
init_config

log "== Versión"
log "actual:   $(state_get current || true)  (commit $(state_get commit || true))"
log "anterior: $(state_get previous || true)"
log "último respaldo previo a una migración: $(state_get last_backup || true)"
log "imagen en ejecución: $(docker inspect -f '{{.Config.Image}}  revisión={{index .Config.Labels "org.opencontainers.image.revision"}}' "$APP_CONTAINER" 2>/dev/null || echo 'app no está en ejecución')"

log; log "== Contenedores"
compose ps --format 'table {{.Name}}\t{{.Status}}\t{{.Ports}}' 2>&1 | redact

log; log "== Salud"
docker inspect -f 'app: {{.State.Health.Status}}' "$APP_CONTAINER" 2>/dev/null || log "app: ausente"
docker exec "$APP_CONTAINER" node -e "fetch('http://127.0.0.1:3000/api/health').then(async r=>console.log('/api/health', r.status, await r.text())).catch(e=>console.log('/api/health sin respuesta'))" 2>/dev/null || true

log; log "== Imágenes de la aplicación disponibles (para rollback.sh)"
docker image ls jds_app --format '{{.Tag}}  {{.CreatedSince}}  {{.Size}}' 2>/dev/null || true

log; log "== Últimas líneas de log de la app (secretos enmascarados)"
compose logs --no-color --tail=20 app 2>&1 | redact
