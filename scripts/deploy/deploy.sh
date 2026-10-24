#!/usr/bin/env bash
# Despliegue de una versión (F6-04). SE EJECUTA EN EL SERVIDOR, en la raíz del repositorio:
#
#   JDS_ENV_FILE=/ruta/segura/.env.prod scripts/deploy/deploy.sh vMAJOR.MINOR.PATCH [--dry-run]
#
# Pasos: etiqueta de Git → árbol limpio → construir imágenes → RESPALDO de la BD y las fotos → migrar →
# levantar app y proxy → esperar a que estén sanos → precalentar. Si la app nueva no llega a estar sana, VUELVE SOLA a
# la imagen anterior (las migraciones NO se deshacen: ver «Migraciones compatibles hacia atrás» en docs/DESPLIEGUE.md).
# Con --dry-run imprime lo que haría sin modificar nada. Nunca ejecuta órdenes destructivas.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/../.."
# shellcheck source=scripts/deploy/lib.sh
source "$SCRIPT_DIR/lib.sh"

# Todo el cuerpo va en una función: bash la lee entera ANTES de ejecutarla, así que el `git checkout` de la etiqueta
# (que puede cambiar este mismo archivo) no altera la ejecución en curso.
main() {
  parse_common_flags "$@"
  TAG="${POSITIONAL[0]:-}"
  [[ -n "$TAG" ]] || die "Uso: deploy.sh vMAJOR.MINOR.PATCH [--dry-run]"
  valid_tag "$TAG" || die "La etiqueta debe tener el formato vMAJOR.MINOR.PATCH (p. ej. v1.0.0)."
  init_config

  PREVIOUS="$(state_get current)"
  [[ "$DRY_RUN" == "1" ]] && log "== SIMULACIÓN (--dry-run): no se modifica nada =="
  log "Versión a desplegar: ${TAG}   (actual: ${PREVIOUS:-ninguna})"

  # 1. Código de la etiqueta
  if git remote get-url origin >/dev/null 2>&1; then
    run git fetch --tags --quiet origin
  else
    log "Sin remoto «origin»: se usan las etiquetas locales."
  fi
  git rev-parse -q --verify "refs/tags/${TAG}" >/dev/null || die "La etiqueta ${TAG} no existe (git fetch --tags)."
  if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
    die "El árbol de trabajo tiene cambios sin confirmar: no se despliega (git status)."
  fi
  run git checkout --quiet --detach "$TAG"
  if [[ "$DRY_RUN" == "1" ]]; then COMMIT="$(git rev-parse --short "refs/tags/${TAG}^{commit}")"; else COMMIT="$(git rev-parse --short HEAD)"; fi
  log "Código: ${TAG} (${COMMIT})"

  export JDS_VERSION="$TAG" GIT_COMMIT="$COMMIT"

  # 2. Imágenes (construcción en el propio servidor, linux/arm64)
  log "== Construyendo imágenes ${TAG}"
  run compose build app migrate

  # 3. Respaldo ANTES de migrar (BD y fotos). Sin respaldo no se migra.
  log "== Respaldo previo a la migración"
  run compose up -d --no-deps db
  if [[ "$DRY_RUN" != "1" ]]; then
    for _ in $(seq 1 40); do
      [[ "$(docker inspect -f '{{.State.Health.Status}}' jds_db 2>/dev/null || true)" == "healthy" ]] && break
      sleep 3
    done
    [[ "$(docker inspect -f '{{.State.Health.Status}}' jds_db)" == "healthy" ]] || die "La base de datos no está sana: no se migra."
  fi
  if [[ "$DRY_RUN" == "1" ]]; then
    run compose run --rm -T tools bash scripts/backup.sh
    BACKUP_ID="(AAAAMMDD-HHMMSS)"
  else
    OUT="$(compose run --rm -T tools bash scripts/backup.sh)" || die "El respaldo falló: no se migra."
    BACKUP_ID="$(grep -oE 'jds-[0-9]{8}-[0-9]{6}' <<<"$OUT" | tail -n 1 | sed 's/^jds-//')"
    [[ -n "$BACKUP_ID" ]] || die "No se pudo identificar el respaldo creado: no se migra."
    log "Respaldo creado: ${BACKUP_ID}"
  fi
  state_set last_backup "$BACKUP_ID"

  # 4. Migraciones (solo con la BD sana; nunca migrate dev ni db push)
  log "== Migraciones"
  if ! run compose run --rm -T migrate; then
    die "La migración falló. La aplicación anterior sigue en marcha. Respaldo previo: ${BACKUP_ID}. Revisa los logs; no se ha cambiado de versión."
  fi

  # 5. Nueva versión
  log "== Levantando ${TAG}"
  # `up` espera a que `app` esté sana (el proxy depende de ella) y devuelve error si no lo está: no es motivo para
  # abortar aquí, sino para pasar a la vuelta atrás de más abajo.
  run compose up -d --no-build app proxy || log "docker compose up terminó con error: la aplicación no llegó a estar sana."

  if wait_healthy; then
    warm_up
    state_set previous "${PREVIOUS}"
    state_set current "$TAG"
    state_set commit "$COMMIT"
    log "OK: ${TAG} (${COMMIT}) desplegada y sana. Respaldo previo: ${BACKUP_ID}."
    return 0
  fi

  # 6. Fallo de salud: vuelta automática a la imagen anterior
  log "FALLO: ${TAG} no llegó a estar sana en ${JDS_HEALTH_TIMEOUT}s."
  if [[ -z "$PREVIOUS" ]] || ! image_exists "jds_app:${PREVIOUS}"; then
    log "No hay versión anterior desplegada a la que volver (primer despliegue o imagen ausente)."
    log "Último log de la app (sin secretos):"
    compose logs --tail=30 app 2>&1 | redact || true
    return 1
  fi
  log "Log de la versión fallida (últimas líneas, secretos enmascarados):"
  compose logs --no-color --tail=30 app 2>&1 | redact || true
  log "Volviendo automáticamente a ${PREVIOUS}…"
  export JDS_VERSION="$PREVIOUS"
  export GIT_COMMIT="$(state_get commit)"
  run compose up -d --no-build --force-recreate app proxy || log "docker compose up terminó con error durante la vuelta atrás."
  if wait_healthy; then
    warm_up
    log "Revertido a ${PREVIOUS}. Las migraciones aplicadas NO se deshicieron (deben ser compatibles hacia atrás)."
    log "Respaldo previo a este intento: ${BACKUP_ID}."
    return 1
  fi
  log "ATENCIÓN: tampoco ${PREVIOUS} llegó a estar sana. Revisa scripts/deploy/status.sh y logs.sh; respaldo disponible: ${BACKUP_ID}."
  return 2
}

main "$@"
exit $?
