# F0-07: Pipeline de CI mínimo

- **Estado:** DONE
- **Fase:** 0
- **Depende de:** F0-04, F0-06
- **Prioridad:** Baja

## Contexto

Se quiere detectar regresiones en cada cambio. El remoto del repositorio aún no está definido; se asume GitHub y se escribe un workflow de GitHub Actions que funcione cuando exista el remoto. El despliegue al servidor Oracle (SSH) queda para la Fase 6, no se implementa aquí.

## Alcance

1. `.github/workflows/ci.yml` que se ejecute en `push` a `main` y en `pull_request`:
   - checkout, instalación de pnpm y Node (versión de `.nvmrc`), caché de dependencias;
   - servicio MySQL 8.0 (`services:` con healthcheck) para pruebas que lo requieran;
   - pasos: `pnpm install --frozen-lockfile`, `prisma generate`, `prisma migrate deploy`, `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
2. Variables de entorno de CI definidas en el workflow (nunca secretos reales).
3. Cancelar ejecuciones obsoletas con `concurrency`.
4. Badge de estado en `README.md` con marcador del repositorio (`TODO(owner/repo)` hasta que exista el remoto).
5. Nota en `README.md` indicando que el despliegue (Oracle + SSH) se definirá en la Fase 6.

## Fuera de alcance

Despliegue, publicación de imágenes Docker, análisis de seguridad (Dependabot opcional, se evaluará en Fase 5).

## Criterios de aceptación

- [x] El workflow es válido (verificar con `actionlint` si está disponible, o revisión manual de sintaxis YAML).
- [x] Los comandos del workflow ejecutados en local, en el mismo orden, pasan.
- [x] No contiene secretos ni rutas absolutas locales.

## Verificación

```bash
pnpm install --frozen-lockfile && pnpm prisma generate && pnpm prisma migrate deploy
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

## Notas de entrega

- **Qué se hizo:**
  1. Configuración de `.github/workflows/ci.yml` ejecutándose en `push` a `main` y en `pull_request`, con cancelación de tareas obsoletas con `concurrency`.
  2. Detección automática y consistente de la versión de Node desde `.nvmrc` y caché nativa de `pnpm`.
  3. Contenedor de servicio MySQL 8.0 con healthcheck activo (`mysqladmin ping`).
  4. Pasos completos de validación en orden idéntico a las especificaciones:
     - `pnpm install --frozen-lockfile`
     - `pnpm prisma generate`
     - `pnpm prisma migrate deploy`
     - `pnpm format:check`
     - `pnpm lint`
     - `pnpm typecheck`
     - `pnpm test`
     - `pnpm build`
  5. Adición del remoto oficial `git@github.com:wilfranr/jds-vehicles.git` e incorporación del badge de estado de CI en `README.md`.
  6. Inclusión de nota en `README.md` especificando que el despliegue en servidor Oracle (SSH) se abordará en la Fase 6.
  7. Validación de sintaxis YAML sin secretos ni rutas absolutas locales.
  8. Ejecución local idéntica y exitosa de todos los pasos del workflow.
- **Desviaciones:** Ninguna.
- **Comandos de verificación ejecutados con éxito:**
  - `pnpm install --frozen-lockfile && pnpm prisma generate && pnpm prisma migrate deploy`
  - `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build`
