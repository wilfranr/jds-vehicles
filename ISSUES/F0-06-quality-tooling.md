# F0-06: ESLint, Prettier, typecheck y Vitest

- **Estado:** TODO
- **Fase:** 0
- **Depende de:** F0-02
- **Prioridad:** Media

## Contexto
Hay que fijar estándares de calidad desde el inicio para que los agentes y personas que contribuyan produzcan código homogéneo, y tener un runner de pruebas listo para las reglas de negocio (Fase 3 exigirá tests de la máquina de estados de reservas y de concurrencia).

## Alcance
1. **Prettier** con config en el repo (`.prettierrc`: sin punto y coma opcional según preferencia del scaffold, comillas simples, `printWidth` 100, plugin de Tailwind `prettier-plugin-tailwindcss`) y `.prettierignore`.
2. **ESLint**: ampliar la config de Next.js con reglas para TypeScript (`@typescript-eslint/no-unused-vars`, `consistent-type-imports`) e integrar `eslint-config-prettier`.
3. **Vitest** + `@testing-library/react` + `jsdom` para componentes; configuración con alias `@/*`. Estructura: tests junto al código (`*.test.ts(x)`).
4. Dos pruebas de ejemplo que pasen: una unitaria de utilidad (ej. `src/lib/format.ts` con `formatCOP(115000000)` → `"$ 115.000.000"` usando `Intl.NumberFormat('es-CO')`) y una de `StatusBadge` si ya existe (si F0-03 no está hecho, solo la de utilidad).
5. Scripts: `format`, `format:check`, `test`, `test:watch`, `typecheck`, y `check` que ejecute `format:check && lint && typecheck && test`.
6. Hook de pre-commit con `husky` + `lint-staged` (Prettier y ESLint sobre archivos staged). Opcional: `commitlint` **no** se incluye.
7. Configuración del editor: `.editorconfig` y `.vscode/extensions.json` recomendando ESLint/Prettier/Tailwind IntelliSense.
8. Documentar en `README.md` los comandos de calidad.

## Fuera de alcance
Tests end-to-end (Playwright, Fase 5), cobertura mínima obligatoria.

## Criterios de aceptación
- [ ] `pnpm check` pasa en limpio.
- [ ] Un commit con un archivo mal formateado queda formateado automáticamente por el hook, y uno con error de ESLint es rechazado.
- [ ] `pnpm test` ejecuta y pasa las pruebas de ejemplo.
- [ ] No hay conflictos entre ESLint y Prettier.

## Verificación
```bash
pnpm check
pnpm test
```
