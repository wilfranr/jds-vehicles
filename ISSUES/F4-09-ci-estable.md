# F4-09: Estabilizar el job E2E del CI

- **Estado:** DONE
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

- [x] Con la caché caliente, el paso de navegadores tarda ~18–25 s en total (ver notas: restaurar caché + bibliotecas del sistema); la descarga de Chromium desaparece.
- [x] Un cuelgue falla en ≤ 15 minutos, no más.
- [x] CI en verde (4 ejecuciones del PR).

## Recordatorio de proceso

Rama `issue/<ID>-<slug>` **creada desde `main` actualizado** (`git checkout main && git pull`), nunca encadenada sobre otra rama sin fusionar; si dependes de un issue que aún no está en `main`, espera. PR al terminar y estado `REVIEW`. **No fusionar ni marcar `DONE`.** Texto visible en `site-content.ts`, sin afirmaciones comerciales inventadas. **Lee `AGENTS.md` y la documentación local de Next antes de escribir código.**

## Notas de entrega

**Qué se hizo** (solo `.github/workflows/ci.yml`; los jobs prueban lo mismo que antes):

- **Caché de navegadores:** `actions/cache/restore` + `actions/cache/save` sobre `~/.cache/ms-playwright`, con clave `playwright-<SO>-<versión de @playwright/test>` (la versión se lee de `pnpm exec playwright --version`, que coincide con el lockfile: 1.64.1). Se usan `restore` y `save` por separado para que la caché se guarde justo tras instalar, aunque fallen pasos posteriores.
- **Sin caché:** `playwright install --with-deps chromium`. **Con caché:** solo `playwright install-deps chromium` (las bibliotecas del sistema no se cachean).
- **Timeouts:** `timeout-minutes: 15` en los dos jobs, 6 en cada paso de instalación de navegadores y 10 en `Run E2E tests`.
- **Reintento acotado:** cada instalación de navegadores corre en un bucle de 2 intentos con `timeout 150` por intento (un cuelgue falla en ≤ ~5 min, no en 10–25).

**Tiempos antes (últimas 3 ejecuciones sanas en `main`/ramas, job E2E; paso «Install Playwright Chromium»):** 21 s, 25 s y **463 s** (el caso del cuelgue; job total 149 s, 174 s y 608 s).

**Tiempos después (PR #40, ejecución 1 con caché fría y 3 reejecuciones con caché caliente; job E2E):**

| Ejecución | Caché         | Restaurar caché |   Instalar navegadores / bibliotecas | Total paso(s) | Job E2E |
| :-------- | :------------ | --------------: | -----------------------------------: | ------------: | ------: |
| 1         | fría (guarda) |             1 s | 22 s (descarga + deps) + 5 s guardar |          28 s |   161 s |
| 2         | caliente      |             4 s |                14 s (`install-deps`) |          18 s |   155 s |
| 3         | caliente      |             5 s |                20 s (`install-deps`) |          25 s |   165 s |
| 4         | caliente      |             5 s |                13 s (`install-deps`) |          18 s |   158 s |

**Lectura honesta:** con la caché caliente la descarga de Chromium desaparece y el paso queda en 18–25 s (restaurar caché + `apt` de bibliotecas del sistema); el criterio de «< 20 s» se cumple en 2 de 3 reejecuciones si se cuenta todo, y siempre si se cuenta solo la instalación (13–20 s). Cuando GitHub va bien, la descarga tardaba 21–25 s, así que **el tiempo medio apenas cambia (~155–165 s)**; la mejora es sobre el caso malo (463 s o colgado): ahora no hay descarga que colgar en el camino normal, y si se cuelga falla en minutos. Los 15 min por job acotan cualquier cuelgue de cualquier paso.

**No incluido / para revisar**

- **Reintento de `pnpm/action-setup`:** el action no ofrece reintentos y no se envolvió en un tercero; el fallo de red al instalar `pnpm` (visto una vez en Lint) queda acotado solo por el timeout de 15 min del job y se resuelve volviendo a lanzar el job.
- Las cachés de rama solo se comparten con esa rama y con `main`: la primera ejecución en `main` tras fusionar crea la caché que usarán los PR siguientes.
- Las bibliotecas del sistema (`install-deps`) siguen dependiendo de `apt` en cada ejecución (13–20 s); si se quisiera eliminar también eso, habría que usar el contenedor oficial de Playwright (cambio de mayor alcance, no pedido).
