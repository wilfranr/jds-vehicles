# F5-04: Páginas legales y lista de pendientes del propietario

- **Estado:** REVIEW
- **Fase:** 5
- **Depende de:** F4-08 (DONE)
- **Prioridad:** Media

## Contexto

El registro recoge documento de identidad, teléfono y dirección y guarda la fecha de aceptación (F2-02). Falta el texto legal definitivo (Ley 1581 de 2012, a confirmar con asesoría legal) que debe aportar el propietario; mientras tanto no se publica nada inventado. Las cifras de marca ("42 vehículos", "100 % garantía", "48 h", "120 puntos") son provisionales.

## Alcance

1. Rutas `/privacidad` (política de tratamiento de datos personales) y `/terminos` (términos del servicio) que leen su contenido de `src/lib/legal-content.ts` (secciones estructuradas: título, fecha de vigencia, responsable, finalidades, derechos, canales, etc.). **Mientras el contenido esté vacío o marcado `TODO(owner)` la ruta responde 404 y no se enlaza en ninguna parte** (pie, registro). Cuando exista contenido, aparecen enlaces en el pie y junto a la casilla de consentimiento del registro (el texto de la casilla se ajusta para mencionarlos). Título, `canonical` e indexación normales; fecha de última actualización visible.
2. **Aviso de cookies:** la aplicación solo usa cookies estrictamente necesarias (sesión de Auth.js y su CSRF). Verificarlo con una prueba e2e que lista todas las cookies tras recorrer el sitio como anónimo y como usuario; documentar que, mientras sea así, no se requiere banner de consentimiento, y mostrar en la política (cuando exista) la lista de cookies. Si apareciera alguna otra, la prueba debe fallar.
3. **Derechos del titular (mínimo viable):** definir en `site-content.ts` y mostrar, cuando exista el contenido legal, el canal para ejercer derechos (correo del concesionario) — solo si el propietario lo aporta; sin canal, no se muestra. Para el personal: en `/admin/usuarios` ya se puede desactivar; añadir al README el procedimiento manual para exportar/eliminar los datos de una persona (qué tablas, qué conservar por la venta registrada) y marcarlo `TODO(owner)` para validación legal.
4. **`ISSUES/PENDIENTES-PROPIETARIO.md`:** lista única y fechada de lo que solo el propietario puede decidir o aportar, cada ítem con dónde se usa en el código (buscar `TODO(owner)`): textos legales, cifras de marca, colores de contraste que difieren de `DESIGN.md`, plazo de reserva (48 h), tope de reservas (2), permisos de ASESOR, fotos en disco, dominio del sitio, correo para recuperar contraseña, dirección/horario/mapa, número de WhatsApp oficial. Un test que falle si aparece un `TODO(owner)` en el código que no esté listado en ese archivo.
5. Tests: render condicional de las páginas, enlaces del pie/registro, 404 sin contenido, lista de cookies.

## Fuera de alcance

Redactar los textos legales (los aporta el propietario), banner de cookies, gestión de consentimientos en BD más allá de la fecha ya guardada.

## Criterios de aceptación

- [x] Sin contenido legal: `/privacidad` y `/terminos` dan 404 y no hay enlaces a ellas.
- [x] Con un contenido de prueba (en un test): las páginas aparecen, enlazadas en pie y registro.
- [x] El test de cookies pasa y el de `TODO(owner)` cubre todos los marcadores.
- [x] `pnpm check`, `pnpm build` y `pnpm test:e2e` pasan; CI en verde.

## Recordatorio de proceso

Rama `issue/<ID>-<slug>` **creada desde `main` actualizado** (`git checkout main && git pull`), nunca encadenada sobre otra rama sin fusionar. PR al terminar y estado `REVIEW`. **No fusionar ni marcar `DONE`.** Las pruebas que usan la BD real se llaman `*.db.test.ts`; los e2e usan datos propios (nunca “la primera tarjeta” ni conteos globales) y no dejan residuos. Antes de empujar: `pnpm check`, `pnpm build` y `pnpm test:e2e` varias veces seguidas. Si el job E2E del CI falla en “Install Playwright system dependencies” es la red de `apt`: `gh run rerun --failed`. Texto visible en `site-content.ts`, sin afirmaciones comerciales inventadas. **Lee `AGENTS.md` y la documentación local de Next antes de escribir código.**

## Notas de entrega

**Qué se hizo**

1. **Páginas legales:** `/privacidad` y `/terminos` (`src/app/(public)/…`) leen `src/lib/legal-content.ts` (título, vigencia, última actualización, responsable, secciones). `src/lib/legal.ts` decide si un documento es publicable: completo, fechas válidas y **sin `TODO(owner)`** en ningún campo. Hoy ambos son `null`: las rutas responden **404** (comprobado por e2e), no hay enlaces (pie, registro, sitemap) ni metadatos. Con contenido de prueba (en los tests) aparecen, con título, `canonical`, indexación normal y las dos fechas visibles; el pie muestra la columna «Legal» y el registro un «Consulta: Política de privacidad · Términos del servicio» junto a la casilla (la etiqueta de la casilla no cambia; los enlaces van fuera de ella).
2. **Cookies:** `e2e/cookies.spec.ts` recorre el sitio como anónimo, cliente y ADMIN y falla ante cualquier cookie que no esté en `essentialCookies` (`authjs.session-token`, `authjs.csrf-token`, `authjs.callback-url`, con o sin prefijo `__Secure-`/`__Host-`). La política (cuando exista) muestra esa tabla. Documentado en el README que mientras sea así no hace falta banner.
3. **Derechos del titular:** `siteContent.legal.rightsEmail` vacío (`TODO(owner)`) ⇒ no se muestra canal; si se rellena con un correo válido aparece en la política. README: procedimiento manual de exportación/rectificación/supresión (qué tablas, qué se conserva por la venta registrada; las FK son `RESTRICT`, por lo que se anonimiza en vez de borrar) marcado `TODO(owner)` para validación legal.
4. **`ISSUES/PENDIENTES-PROPIETARIO.md`:** 14 ítems fechados (2026-10-23) con dónde se usan. `src/lib/owner-pending.test.ts` falla si un archivo de código (src, prisma, scripts, e2e, .github, README, `.env.example`) contiene `TODO(owner)` y no está citado en la lista, y si la lista cita rutas inexistentes. Se exceptúan los `*.test.*` y `src/lib/legal.ts` (usan el marcador como dato).
5. Se retiró el `TODO(owner)` obsoleto de `footerLinks` (ahora los enlaces legales salen de `legal.ts`); queda anotado el de `/certificacion`.

**Pruebas:** `pnpm check` (69 archivos, 652 pruebas), `pnpm build` (el resumen solo añade `◐ /privacidad` y `◐ /terminos`, que responden 404 mientras no haya contenido), `pnpm test:e2e` ×3: 87/87 cada vez.

**A revisar**

- Falta que el propietario aporte los textos: basta rellenar `src/lib/legal-content.ts` (y `siteContent.legal.rightsEmail`).
- Los ítems 9, 10 y 12 de la lista no tienen marcador en el código (son decisiones documentadas en README/ISSUES); el test solo cubre marcadores.
- El procedimiento de supresión (anonimizar) es una propuesta técnica, no asesoría legal.
