# F6-04: Script de despliegue, versiones y reversión

- **Estado:** TODO
- **Fase:** 6
- **Depende de:** F6-02, F6-03
- **Prioridad:** Alta

## Contexto

Despliegue manual y reproducible (sin despliegue automático desde GitHub: exigiría guardar llaves SSH como secretos). Lo ejecuta el orquestador por SSH con la autorización del propietario en cada paso que modifica el servidor.

## Alcance

1. `scripts/deploy/deploy.sh <tag>` (bash, `set -euo pipefail`) que se ejecuta **en el servidor**: obtiene el código de una etiqueta de Git (`git fetch --tags`, `git checkout <tag>`, verificación de que el árbol está limpio), construye la imagen etiquetada con la versión y el commit, **respalda la BD antes de migrar** (script de F5-03), ejecuta `migrate`, levanta `app` con la imagen nueva, espera el `HEALTHCHECK`/`/api/health` hasta un tiempo máximo y, si falla, **vuelve automáticamente** a la imagen anterior (sin deshacer migraciones destructivas: documentar la política de migraciones compatibles hacia atrás en dos pasos).
2. `scripts/deploy/rollback.sh`, `scripts/deploy/status.sh` (versión desplegada, estado de contenedores, últimas líneas de log **sin secretos**) y `scripts/deploy/logs.sh`.
3. Versionado: etiquetas `vMAJOR.MINOR.PATCH` creadas por el orquestador tras fusionar; `CHANGELOG.md` mínimo. El número de versión visible en `/api/health` es opcional y **solo** el hash corto, nunca rutas.
4. Todo script soporta `--dry-run` que imprime lo que haría. Ninguna orden destructiva (`down -v`, `rm -rf`, `prune`) sin confirmación escrita.
5. Pruebas: ejecutar el ciclo completo (desplegar v1 → desplegar v2 → forzar un fallo de salud en v3 → comprobar el rollback automático) **en local con Docker** y pegar la evidencia.
6. `docs/DESPLIEGUE.md`: procedimiento paso a paso, rollback, qué hacer si se pierde el acceso, y registro de lo que cambia en el servidor.

## Criterios de aceptación

- [ ] El ciclo v1 → v2 → v3 fallida → rollback automático funciona en local.
- [ ] Siempre hay una copia de la BD anterior a cada migración.
- [ ] `--dry-run` no modifica nada.
- [ ] CI en verde.

## Recordatorio de proceso

Rama `issue/<ID>-<slug>` **desde `main` actualizado**, sin encadenar. PR al terminar y estado `REVIEW`; **no fusionar ni marcar `DONE`**. Pruebas con BD como `*.db.test.ts`; e2e con datos propios. `pnpm check`, `pnpm build` y `pnpm test:e2e` antes de empujar. **Nunca** poner secretos, IPs privadas ni llaves en el repositorio, en logs ni en las notas de entrega. **Lee `AGENTS.md` y la documentación local de Next.**
