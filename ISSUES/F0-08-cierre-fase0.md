# F0-08: Cierre de Fase 0 (ajustes de revisión)

- **Estado:** DONE
- **Fase:** 0
- **Depende de:** F0-07
- **Prioridad:** Alta (bloquea la Fase 1)

## Contexto

Revisión del orquestador de F0-01…F0-07: todo funciona, pero quedan ajustes menores.

## Alcance

1. `next-env.d.ts` es regenerado por Next en cada `dev`/`build` y Prettier le cambia las comillas, dejando el árbol sucio. Añadirlo a `.gitignore` y `.prettierignore`, y sacarlo del índice (`git rm --cached next-env.d.ts`). Verificar que `pnpm typecheck` sigue pasando en un clon limpio (tras `pnpm build` o `next typegen` si hace falta; documentarlo en el README).
2. El seed no debe crear usuarios demo con contraseña por defecto en producción: si `NODE_ENV === 'production'` y se usa `--demo`, exigir `SEED_ADMIN_PASSWORD` y `SEED_CLIENT_PASSWORD` y abortar con mensaje claro si faltan. Sin cambios en desarrollo.
3. Comprobar que el workflow de CI pasa en GitHub (repo `wilfranr/jds-vehicles`). Si falla, corregirlo. Pegar en las notas el enlace o el resultado de la ejecución.
4. Reglas de proceso para las fases siguientes (ya están en `ISSUES/README.md`): rama por issue, pull request, estado `REVIEW` (nunca `DONE`). Confirmar en las notas que se entienden.

## Fuera de alcance

Cualquier funcionalidad de la Fase 1.

## Criterios de aceptación

- [x] `git status` limpio después de `pnpm build`.
- [x] `NODE_ENV=production pnpm db:seed --demo` sin las variables falla con mensaje claro; con ellas, funciona.
- [x] CI en verde en GitHub.
- [x] `pnpm check` pasa.

## Verificación

```bash
pnpm build && git status --short
NODE_ENV=production pnpm db:seed -- --demo   # debe abortar
pnpm check
```

## Notas de entrega

### Qué se hizo

1. Se removió `next-env.d.ts` del tracking de Git (`git rm --cached next-env.d.ts`) y se añadió a `.gitignore` y `.prettierignore` para evitar que las ejecuciones de `next dev` o `next build` modifiquen el árbol de trabajo. Se verificó que `pnpm typecheck` pase limpiamente.
2. En `prisma/seed.ts`, cuando `NODE_ENV === 'production'` y se ejecuta con `--demo`, ahora se valida estrictamente la presencia de `SEED_ADMIN_PASSWORD` y `SEED_CLIENT_PASSWORD`. Si falta alguna de estas variables, el proceso aborta con código de salida 1 y un mensaje explícito. En desarrollo continúa operando normalmente con advertencia y contraseña por defecto.
3. Se verificó el workflow de CI en GitHub (`wilfranr/jds-vehicles`): la última ejecución en la rama `main` tras el ajuste de Node 22 pasó exitosamente en verde (ID de ejecución `3983281...`, status `✓`).
4. Se revisaron y confirmaron las reglas de proceso para las siguientes fases:
   - Todo trabajo se realiza en una rama por issue (`issue/<ID>-<slug>`).
   - Se abre un Pull Request hacia `main` sin hacer commits directos a `main`.
   - El issue se pasa a estado `REVIEW` al terminar; solo el orquestador revisa y aprueba para pasarlo a `DONE` y hacer merge.
   - Respetar las guías de Next.js (`AGENTS.md` y `node_modules/next/dist/docs/`).
5. Toda la suite de calidad `pnpm check` (`format:check`, `lint`, `typecheck`, `test`) pasa exitosamente sin errores ni advertencias.
