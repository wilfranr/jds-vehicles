# F4-09: Estabilizar el job E2E del CI

- **Estado:** IN PROGRESS
- **Fase:** 4
- **Depende de:** — (puede hacerse primero y en paralelo)
- **Prioridad:** Alta (hoy el job se queda colgado 10–25 minutos en la descarga de Chromium)

## Contexto

Varias veces el job _E2E (Playwright)_ se quedó en el paso "Install Playwright Chromium" sin avanzar (descarga lenta o colgada), y en un caso _Lint_ falló por un error de red al instalar `pnpm`. Cada espera bloquea la revisión y la fusión de los PRs.

## Alcance

1. En `.github/workflows/ci.yml`: **cachear los navegadores de Playwright** (`~/.cache/ms-playwright`, clave con la versión de `@playwright/test` del lockfile) con `actions/cache` y ejecutar `playwright install --with-deps chromium` solo si no hay caché (o usar `install` que ya omite lo presente).
2. `timeout-minutes` explícito por job (p. ej. 15) y por el paso de instalación de navegadores (5), para que un cuelgue falle rápido en lugar de esperar horas.
3. Reintento acotado del paso de instalación de navegadores (1 reintento) y de la instalación de `pnpm` si el action lo permite.
4. Mantener los jobs actuales sin cambiar lo que prueban. Anotar en el PR los tiempos antes y después (3 ejecuciones).

## Criterios de aceptación

- [ ] Con la caché caliente, el paso de navegadores tarda menos de 20 segundos.
- [ ] Un cuelgue falla en ≤ 15 minutos, no más.
- [ ] CI en verde.

## Recordatorio de proceso

Rama `issue/<ID>-<slug>` **creada desde `main` actualizado** (`git checkout main && git pull`), nunca encadenada sobre otra rama sin fusionar; si dependes de un issue que aún no está en `main`, espera. PR al terminar y estado `REVIEW`. **No fusionar ni marcar `DONE`.** Texto visible en `site-content.ts`, sin afirmaciones comerciales inventadas. **Lee `AGENTS.md` y la documentación local de Next antes de escribir código.**
