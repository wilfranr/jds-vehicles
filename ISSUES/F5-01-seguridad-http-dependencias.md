# F5-01: Seguridad HTTP y de dependencias

- **Estado:** DONE
- **Fase:** 5
- **Depende de:** F4-08 (DONE)
- **Prioridad:** Alta

## Contexto

`next.config.ts` ya envía `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options` y `Permissions-Policy`; el comentario deja la CSP estricta para esta fase. El sitio se servirá detrás de un proxy inverso con HTTPS (Fase 6). El proyecto depende de `next-auth` 5 beta y de `sharp`.

## Alcance

1. **Content-Security-Policy** estricta: seguir la guía de CSP de la documentación local de Next 16 (nonce por petición o la alternativa que indique; documentar la elección y su efecto en el prerenderizado/PPR: **no convertir las páginas públicas en dinámicas sin necesidad**, medirlo con el resumen de `pnpm build`). Orígenes permitidos solo los necesarios (`'self'`, `images.unsplash.com` para las fotos del seed, `wa.me` solo como destino de enlace, no de recursos). `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`, `object-src 'none'`. Empezar en modo `Content-Security-Policy-Report-Only` en desarrollo para ajustar, y dejar la política **aplicada** en producción. Una ruta `/api/csp-report` mínima y limitada (solo registra una línea JSON, tamaño máximo, sin guardar nada del cuerpo en bruto) es opcional.
2. **Otras cabeceras:** `Strict-Transport-Security` (1 año, `includeSubDomains`) **solo si** `NODE_ENV=production` y la petición llegó por HTTPS (`X-Forwarded-Proto`); `Cross-Origin-Opener-Policy: same-origin`; `Cross-Origin-Resource-Policy: same-origin` (las fotos de `/media` ya salen con `nosniff`). Quitar `X-Powered-By` (`poweredByHeader: false`).
3. **Pruebas:** unitarias del constructor de la política (sin duplicados ni `'unsafe-inline'`/`'unsafe-eval'` en producción), y un e2e que recorra portada, catálogo, ficha, login, registro, mi cuenta y el panel comprobando que **no hay violaciones de CSP en consola** y que las cabeceras están presentes.
4. **Dependencias en CI:** `pnpm audit --prod` como paso del CI que falle con vulnerabilidades `high`/`critical` (documentar cómo se justifica una excepción puntual); configuración de Dependabot para `pnpm` y `github-actions` (semanal, agrupando minor/patch); revisar que `pnpm-lock.yaml` esté fijado y que no haya dependencias sin usar (`knip` o similar solo si es ligero; si no, hacerlo a mano y anotarlo).
5. **Secretos:** paso de CI con un escáner de secretos (p. ej. `gitleaks` fijado por versión) sobre el repositorio y un test que garantice que `.env` está ignorado y que `.env.example` no contiene valores reales.
6. **Auth.js beta:** anotar la versión exacta fijada, el riesgo y la condición para actualizar; comprobar que `AUTH_SECRET` débil o por defecto se rechaza en producción (`instrumentation.ts`).
7. README: sección "Seguridad HTTP" (qué cabeceras, por qué, cómo ajustar la CSP).

## Fuera de alcance

WAF, protección DDoS, CAPTCHA, limitador distribuido.

## Criterios de aceptación

- [x] `curl -I` a portada, `/login`, `/admin` y `/media/...` muestra las cabeceras esperadas; la CSP no contiene `unsafe-eval`.
- [x] Ninguna página pública pasa de prerenderizada a dinámica por la CSP (comparar el resumen del build antes/después).
- [x] El e2e de recorrido no registra violaciones de CSP.
- [x] El CI ejecuta audit y escáner de secretos y pasa; `pnpm check`, `pnpm build` y `pnpm test:e2e` pasan.

## Recordatorio de proceso

Rama `issue/<ID>-<slug>` **creada desde `main` actualizado** (`git checkout main && git pull`), nunca encadenada sobre otra rama sin fusionar. PR al terminar y estado `REVIEW`. **No fusionar ni marcar `DONE`.** Las pruebas que usan la BD real se llaman `*.db.test.ts`; los e2e usan datos propios (nunca “la primera tarjeta” ni conteos globales) y no dejan residuos. Antes de empujar: `pnpm check`, `pnpm build` y `pnpm test:e2e` varias veces seguidas. Si el job E2E del CI falla en “Install Playwright system dependencies” es la red de `apt`: `gh run rerun --failed`. Texto visible en `site-content.ts`, sin afirmaciones comerciales inventadas. **Lee `AGENTS.md` y la documentación local de Next antes de escribir código.**

## Notas de entrega

**Decisión principal (a revisar): CSP sin nonce, con `'unsafe-inline'` solo en `script-src`.** La guía local de Next 16 (`content-security-policy.md`) dice que el nonce exige renderizado dinámico de cada petición y es incompatible con PPR. La alternativa `experimental.sri` se probó y **no sirve aquí**: el HTML de la portada trae 35 `<script>` en línea (arranque de React y datos RSC) que `script-src 'self'` bloquearía y la hidratación fallaría. Resultado: cabecera estática vía `headers()` con
`default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self'; style-src-attr 'unsafe-inline'; img-src 'self' data: blob: https://images.unsplash.com; font-src 'self'; connect-src 'self'; media-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests`.
Sin `eval` en producción; `'unsafe-inline'` solo en `script-src` (scripts de Next) y `style-src-attr` (atributos `style` de `next/image`); `<style>` en línea sigue bloqueado. Esto se aparta del texto del issue («sin `'unsafe-inline'`» en el constructor) porque es incompatible con «no volver dinámicas las páginas públicas»; el test lo fija explícitamente y el README explica cómo endurecerlo (nonce ⇒ páginas dinámicas). Si prefieres nonce en rutas ya dinámicas (`/admin`, `/mi-cuenta`), es un issue aparte.

**Prerenderizado:** el resumen de rutas de `pnpm build` es **idéntico** antes y después (`diff` vacío; las mismas `○`/`◐`/`ƒ`, `/` y `/catalogo` siguen `◐`, `/login` y `/registro` `○`).

**Qué se hizo**

1. `src/server/security/headers.ts` (`buildCsp`, `buildSecurityHeaders`, `buildHeaderRules`) usado por `next.config.ts`; en desarrollo la política va como `Content-Security-Policy-Report-Only`. `poweredByHeader: false`; `Cross-Origin-Opener-Policy` y `Cross-Origin-Resource-Policy: same-origin`.
2. HSTS (1 año, `includeSubDomains`) con una regla `has: x-forwarded-proto=https` solo si `NODE_ENV=production`; no pasa por el proxy de la app. Ruta `/api/csp-report`: no se hizo (opcional).
3. **Hallazgo real del e2e:** Zod 4 prueba `Function("")` al validar y el navegador lo registra como violación de `script-src` (5 en `/registro`). Se desactiva con `z.config({ jitless: true })` (`src/lib/validation/zod-setup.ts`, importado desde los módulos de validación).
4. Pruebas: `headers.test.ts` (13: sin duplicados, sin `unsafe-eval`, `unsafe-inline` solo donde corresponde, HSTS, desarrollo) y `e2e/seguridad-http.spec.ts` (8 pruebas: cabeceras en `/`, `/catalogo`, `/login`, `/api/health`, `/media/...`, `/admin` y HSTS; recorrido de visitante/cliente/ADMIN sin violaciones de CSP —eventos `securitypolicyviolation` y consola— y con hidratación comprobada abriendo el menú de usuario).
5. CI: `pnpm audit --prod --audit-level high`, `gitleaks` 8.24.2 (binario con SHA-256 fijado, historial completo, `.gitleaks.toml` con la allowlist de pruebas) y `fetch-depth: 0`. Dependabot semanal para `npm` y `github-actions` (agrupa minor/patch; `next-auth` ignorada a propósito).
6. `pnpm audit --prod` encontró **1 high real**: `deepmerge-ts <8` (GHSA-ggr8-5vv4-36mx) vía `prisma → @prisma/config`. Se corrigió con `overrides: deepmerge-ts: 8.0.2` en `pnpm-workspace.yaml` (con el aviso y la condición de retirada); `prisma generate` y `migrate diff` funcionan. Ahora: «No known vulnerabilities found».
7. Test `secrets.test.ts`: `.env*` ignorados y no versionados (salvo `.env.example`), y `.env.example` solo con vacíos o ejemplos conocidos. `gitleaks` local sobre 88 commits: sin hallazgos (tras permitir contraseñas de prueba en `*.test.ts` y `e2e/`).
8. Dependencias sin uso (revisión manual, sin añadir `knip`): se quitaron `@typescript-eslint/eslint-plugin` y `@typescript-eslint/parser` (llegan con `eslint-config-next`); lint y typecheck siguen verdes.
9. Auth.js: `next-auth@5.0.0-beta.32` fijada exacta; riesgo y condición de actualización en el README («Seguridad HTTP y Dependencias»).

**Pruebas:** `pnpm check` (65 archivos, 643 pruebas), `pnpm build`, `pnpm test:e2e` ×3: 91/91 cada vez.

**A revisar**

- La decisión de `'unsafe-inline'` en `script-src` (arriba).
- Criterio «AUTH_SECRET débil o por defecto se rechaza en producción»: lo implementa F5-03 (PR #56, `src/server/env.ts`, con test); aquí no se toca `src/server/auth/env.ts` para no chocar con ese PR (lo elimina).
- `.gitleaks.toml` exime a `*.test.ts(x)` y `e2e/` (contraseñas de prueba); un secreto real en un test no se detectaría.
