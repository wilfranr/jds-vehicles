# F0-07: Pipeline de CI mínimo

- **Estado:** TODO
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

- [ ] El workflow es válido (verificar con `actionlint` si está disponible, o revisión manual de sintaxis YAML).
- [ ] Los comandos del workflow ejecutados en local, en el mismo orden, pasan.
- [ ] No contiene secretos ni rutas absolutas locales.

## Verificación

```bash
pnpm install --frozen-lockfile && pnpm prisma generate && pnpm prisma migrate deploy
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build
```
