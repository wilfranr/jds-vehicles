# F5-01: Seguridad HTTP y de dependencias

- **Estado:** TODO
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

- [ ] `curl -I` a portada, `/login`, `/admin` y `/media/...` muestra las cabeceras esperadas; la CSP no contiene `unsafe-eval`.
- [ ] Ninguna página pública pasa de prerenderizada a dinámica por la CSP (comparar el resumen del build antes/después).
- [ ] El e2e de recorrido no registra violaciones de CSP.
- [ ] El CI ejecuta audit y escáner de secretos y pasa; `pnpm check`, `pnpm build` y `pnpm test:e2e` pasan.

## Recordatorio de proceso

Rama `issue/<ID>-<slug>` **creada desde `main` actualizado** (`git checkout main && git pull`), nunca encadenada sobre otra rama sin fusionar. PR al terminar y estado `REVIEW`. **No fusionar ni marcar `DONE`.** Las pruebas que usan la BD real se llaman `*.db.test.ts`; los e2e usan datos propios (nunca “la primera tarjeta” ni conteos globales) y no dejan residuos. Antes de empujar: `pnpm check`, `pnpm build` y `pnpm test:e2e` varias veces seguidas. Si el job E2E del CI falla en “Install Playwright system dependencies” es la red de `apt`: `gh run rerun --failed`. Texto visible en `site-content.ts`, sin afirmaciones comerciales inventadas. **Lee `AGENTS.md` y la documentación local de Next antes de escribir código.**
