# F0-06: ESLint, Prettier, typecheck y Vitest

- **Estado:** DONE
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

- [x] `pnpm check` pasa en limpio.
- [x] Un commit con un archivo mal formateado queda formateado automáticamente por el hook, y uno con error de ESLint es rechazado.
- [x] `pnpm test` ejecuta y pasa las pruebas de ejemplo.
- [x] No hay conflictos entre ESLint y Prettier.

## Verificación

```bash
pnpm check
pnpm test
```

## Notas de entrega

- **Qué se hizo:**
  1. Configuración de **Prettier** en `.prettierrc` (comillas simples, punto y coma, tabWidth: 2, printWidth: 100, `prettier-plugin-tailwindcss`) y `.prettierignore`.
  2. Configuración de **ESLint flat config** en `eslint.config.mjs` integrando reglas estrictas para TypeScript (`@typescript-eslint/no-unused-vars` configurado como error ignorando `^_`, `@typescript-eslint/consistent-type-imports` en error con estilo inline) y compatibilidad total con `eslint-config-prettier`.
  3. Configuración de **Vitest** en `vitest.config.mts` con soporte para React, entorno `jsdom`, `@testing-library/react`, `vitest.setup.ts` y mapeo de alias `@/*`.
  4. Dos suites de pruebas automatizadas:
     - Unitaria de utilidad: `src/lib/format.test.ts` probando `formatCOP` (`src/lib/format.ts`).
     - Componente de interfaz: `src/components/ui/StatusBadge.test.tsx` probando la renderización de chips (`NUEVO`, `USADO` como SEMINUEVO, `RESERVADO`, etc.).
  5. Scripts de calidad en `package.json`: `format`, `format:check`, `lint`, `typecheck`, `test`, `test:watch` y `check` (`pnpm format:check && pnpm lint && pnpm typecheck && pnpm test`).
  6. Configuración de **Husky** (`.husky/pre-commit`) y **lint-staged** en `package.json` ejecutando `prettier --write` y `eslint --fix` en archivos preparados. Se probó activamente:
     - Archivo con formato incorrecto es corregido automáticamente antes de commitear.
     - Archivo con error insalvable de ESLint es rechazado y aborta el commit (exit code 1).
  7. Configuración del editor en `.editorconfig` y extensiones recomendadas en `.vscode/extensions.json`.
  8. Documentación agregada a `README.md` explicando todos los comandos del pipeline de calidad.
- **Desviaciones:** Ninguna.
- **Comandos de verificación ejecutados con éxito:**
  - `pnpm check`
  - `pnpm test`
  - `pnpm format:check`
