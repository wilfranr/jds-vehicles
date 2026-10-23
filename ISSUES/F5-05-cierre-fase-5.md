# F5-05: Revisión final de seguridad, cobertura y cierre de la Fase 5

- **Estado:** REVIEW
- **Fase:** 5
- **Depende de:** F5-01, F5-02, F5-03, F5-04
- **Prioridad:** Alta

## Contexto

Antes de desplegar, un cierre que convierta las reglas de seguridad acordadas en pruebas automáticas que protejan el proyecto cuando alguien añada una ruta o acción nueva.

## Alcance

1. **Test de cobertura de autorización por archivo:** recorrer `src/app/(admin)/**` y `src/app/(account)/**` y fallar si una `page.tsx`, `route.ts` o archivo con `'use server'` no llama a `requireStaff`/`requireAdmin`/`requireUser` (o a un envoltorio declarado en una lista blanca con justificación). Debe fallar si se añade una acción sin guardia (probarlo con una fixture).
2. **Test de listas explícitas de campos:** fallar si una acción del panel pasa `Object.fromEntries(formData)` o el cuerpo crudo a Prisma (búsqueda estática simple + fixture).
3. **Mapa de rutas:** generar (script) un listado de todas las rutas con su rol requerido y compararlo con un archivo versionado `docs/RUTAS.md`; el test falla si divergen (así toda ruta nueva exige actualizar el mapa a conciencia).
4. **Cobertura de pruebas:** configurar `vitest --coverage` (v8) con umbrales mínimos para `src/server/**` y `src/lib/**` (fijar el umbral al nivel actual redondeado hacia abajo, sin bajar nunca) y publicarlo en el CI; listar los módulos de `src/server` sin pruebas y cerrar los huecos de mayor riesgo.
5. **Revisión de limitadores:** documentar y probar las políticas finales (login, registro, cambio de contraseña, reservas, restablecimiento de clave por ADMIN, subida de fotos) y añadir el límite de subida de fotos por usuario/hora si no existe. Registrar en el README la limitación de proceso único y la decisión: **desplegar una sola instancia** (la Fase 6 lo respeta).
6. **Matriz de decisiones por confirmar antes de producción** actualizada en `ISSUES/README.md` (enlazando a `PENDIENTES-PROPIETARIO.md`).
7. README: secciones "Seguridad" y "Operación" completas; `docs/RUTAS.md`.

## Criterios de aceptación

- [x] Quitar `requireStaff()` de cualquier página o acción del panel hace fallar un test.
- [x] El mapa de rutas coincide con el código y el CI falla si divergen.
- [x] La cobertura se publica y los umbrales se cumplen.
- [x] `pnpm check`, `pnpm build` y `pnpm test:e2e` pasan; CI en verde.

## Recordatorio de proceso

Rama `issue/<ID>-<slug>` **creada desde `main` actualizado** (`git checkout main && git pull`), nunca encadenada sobre otra rama sin fusionar. PR al terminar y estado `REVIEW`. **No fusionar ni marcar `DONE`.** Las pruebas que usan la BD real se llaman `*.db.test.ts`; los e2e usan datos propios (nunca “la primera tarjeta” ni conteos globales) y no dejan residuos. Antes de empujar: `pnpm check`, `pnpm build` y `pnpm test:e2e` varias veces seguidas. Si el job E2E del CI falla en “Install Playwright system dependencies” es la red de `apt`: `gh run rerun --failed`. Texto visible en `site-content.ts`, sin afirmaciones comerciales inventadas. **Lee `AGENTS.md` y la documentación local de Next antes de escribir código.**

## Notas de entrega

**1–2. Autorización y campos explícitos** (`src/server/security/route-audit.ts` + `route-audit.test.ts`, 20 pruebas): recorre `src/` y falla si una `page.tsx`/`route.ts` de `(admin)` o `(account)` no llama a su guardia, o si **cualquier** Server Action de `src` (función a función, no por archivo) no la llama directa o a través de un helper local que sí invoque (p. ej. `authorize()` de `fotos-actions.ts`; uno que la acción no llama no cuenta). En el panel se exige `requireStaff`/`requireAdmin` (`getFreshUser` no basta); en la cuenta, `requireUser` o `getFreshUser`. Lista blanca de 3 acciones públicas por diseño (login, registro, cierre de sesión) con justificación y detección de entradas obsoletas. Fixtures: acción nueva sin guardia, página sin guardia, helper no llamado, `Object.fromEntries(formData)`, `data: formData|body|payload`, `...body`. **Mutación comprobada:** quitar `requireStaff()` de `/admin/ventas` hace fallar 3 pruebas. Hoy no hay ningún uso de cuerpo crudo.

**3. Mapa de rutas:** `docs/RUTAS.md` generado con `pnpm rutas` (30 páginas/rutas y 28 acciones con su acceso); el test lo compara con el código (en CI falla si divergen). Excluido de Prettier (`.prettierignore`) porque es generado.

**4. Cobertura:** `@vitest/coverage-v8` 5.0.5 (misma versión que Vitest), `pnpm test:coverage` sobre `src/server` y `src/lib`. Antes → después de cerrar huecos: sentencias 93,2 → **95,3 %**, ramas 88,0 → **89,6 %**, funciones 93,1 → **96,7 %**, líneas 94,4 → **96,6 %**. Umbrales fijados al nivel actual redondeado hacia abajo (95 / 89 / 96 / 96). El CI ejecuta `pnpm test:coverage` en lugar de `pnpm test`, escribe la tabla en el resumen del job y sube el informe como artefacto `coverage`. Módulos de `src/server` sin prueba propia y qué se hizo: `account/profile.ts` (0 %, ahora `profile.db.test.ts`: nunca devuelve hash ni rol, cuenta desactivada → null), `auth/referer-next.ts` (0 %, ahora prueba con ataques de redirección abierta vía `safeNextPath`), `catalog/queries.ts` 55 % → destacados y similares (`queries-vistas.db.test.ts`: sin vendidos ni ocultos), `lib/vehicle-id.ts`, `lib/site-url.ts`, `lib/validation/catalog-admin.ts`. Quedan sin prueba directa y de bajo riesgo: `form-state` (constantes), `logout-action.ts`, `reservations/index.ts` y `cache.ts` (re-exportaciones/invalidación de caché, cubiertas por e2e), `media/limits.ts`, `auth/password.ts` (cubierto indirectamente), `events.ts`. Por la carga de la cobertura, la prueba de «10 restablecimientos por hora» (10 hashes bcrypt de coste 12) superó los 5 s por defecto: se le dio 30 s.

**5. Limitadores:** política final documentada en el README (tabla) y probada (`limiters.test.ts`: umbrales exactos de login por par y por IP, registro, subida de fotos, y vaciado de ventanas con reloj simulado). **Nuevo:** límite de subida de fotos, 30 envíos por persona y hora (cada envío ≤ 10 fotos), consultado en `fotos/route.ts` tras la sesión y antes de leer el cuerpo, con mensaje propio (`rateLimited`). Decisión **una sola instancia** registrada en README («Seguridad»), en la matriz de `ISSUES/README.md` y para la Fase 6.

**6. Matriz de decisiones** añadida a `ISSUES/README.md` («Matriz de decisiones por confirmar antes de producción», enlazada a `PENDIENTES-PROPIETARIO.md`), con lo pedido tras F5-01: **`'unsafe-inline'` en `script-src` anotado como riesgo residual** a revisar antes de producción, y **HSTS desactivado en modo IP** (la app lo emite si `X-Forwarded-Proto: https`; se añadió la advertencia a `ISSUES/F6-03-proxy-https-red.md`: el proxy debe eliminar la cabecera o hacerse configurable, con prueba).

**7. README:** secciones «Seguridad (resumen y reglas del proyecto)» y «Operación (resumen)»; `docs/RUTAS.md`.

**Hallazgo de las pruebas:** el helper `reservation()` de e2e (F5-02) generaba códigos de 3 caracteres: con 48 pruebas concurrentes la probabilidad de colisión era ~28 % (un fallo intermitente de `accesibilidad`); ahora usa el alfabeto real de 4 caracteres (1 M de combinaciones).

**Pruebas:** `pnpm check` (83 archivos, 775 pruebas), `pnpm build` (sin cambios de rutas), `pnpm test:e2e` ×3: 157/157 (más una primera pasada con el fallo intermitente ya explicado).

**A revisar**

- Umbral de ramas 89 % (nivel actual 89,6 %): margen de 0,6 pt; si resultara frágil en CI, bajarlo solo con justificación.
- Aparece en los logs del servidor de e2e (ya antes de esta fase) `Route "/proximamente": … crypto.getRandomValues() while prerendering` (también en `/` y `/admin/configuracion`): las páginas responden bien, pero merece un issue propio para localizar qué lo provoca.
- La auditoría es búsqueda de texto: no detecta una guardia llamada pero ignorada (p. ej. sin `await`); sigue haciendo falta revisión humana.
