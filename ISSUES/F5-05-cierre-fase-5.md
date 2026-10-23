# F5-05: Revisión final de seguridad, cobertura y cierre de la Fase 5

- **Estado:** TODO
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

- [ ] Quitar `requireStaff()` de cualquier página o acción del panel hace fallar un test.
- [ ] El mapa de rutas coincide con el código y el CI falla si divergen.
- [ ] La cobertura se publica y los umbrales se cumplen.
- [ ] `pnpm check`, `pnpm build` y `pnpm test:e2e` pasan; CI en verde.

## Recordatorio de proceso

Rama `issue/<ID>-<slug>` **creada desde `main` actualizado** (`git checkout main && git pull`), nunca encadenada sobre otra rama sin fusionar. PR al terminar y estado `REVIEW`. **No fusionar ni marcar `DONE`.** Las pruebas que usan la BD real se llaman `*.db.test.ts`; los e2e usan datos propios (nunca “la primera tarjeta” ni conteos globales) y no dejan residuos. Antes de empujar: `pnpm check`, `pnpm build` y `pnpm test:e2e` varias veces seguidas. Si el job E2E del CI falla en “Install Playwright system dependencies” es la red de `apt`: `gh run rerun --failed`. Texto visible en `site-content.ts`, sin afirmaciones comerciales inventadas. **Lee `AGENTS.md` y la documentación local de Next antes de escribir código.**
