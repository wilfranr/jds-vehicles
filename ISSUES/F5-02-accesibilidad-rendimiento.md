# F5-02: Accesibilidad y rendimiento

- **Estado:** REVIEW
- **Fase:** 5
- **Depende de:** F4-08 (DONE)
- **Prioridad:** Media

## Contexto

En la Fase 1 se midió Lighthouse a mano (accesibilidad 100, SEO 100; 92 en la ficha por metadatos en streaming). Desde entonces se añadieron login, cuenta, reservas, panel y fotos subidas. Además hay un defecto sin diagnosticar: con sesión iniciada el DOM de las páginas dinámicas contiene un segundo `<header>` y `<main>` ocultos (tamaño 0) que ya obligó a usar `getByRole` en los e2e.

## Alcance

1. **axe-core en Playwright** (`@axe-core/playwright`, versión fija): una prueba por página principal que falle con violaciones `serious`/`critical` de WCAG 2.1 AA, en escritorio (1280 px) y móvil (360 px): portada, catálogo (con y sin filtros), ficha, próximamente, cómo funciona, contacto, login, registro, mi cuenta (perfil, seguridad, reservas, detalle), y el panel (resumen, reservas, vehículos, formulario de vehículo con fotos, ventas, usuarios, configuración). Corregir lo que aparezca (contraste, nombres accesibles, orden de foco, `aria`). Excepciones solo con justificación escrita en el propio test.
2. **Teclado:** comprobar y corregir con pruebas e2e que los menús (usuario, móvil, panel), la galería ampliada, los diálogos de confirmación y la subida de fotos se operan solo con teclado, con foco visible y que el foco vuelve a su origen al cerrar. Respeta `prefers-reduced-motion`.
3. **Duplicado oculto de `<header>`/`<main>` con sesión:** encontrar la causa raíz (sospecha: resto del streaming de la carcasa parcial de Cache Components) y corregirla, o, si es inherente al framework, documentarlo con el enlace a la evidencia y asegurar que no afecta a lectores de pantalla (el duplicado debe estar fuera del árbol de accesibilidad). Añadir una prueba que cuente `banner` y `main` visibles (debe ser 1).
4. **Rendimiento:** medir con Lighthouse (móvil, perfil por defecto) portada, catálogo y ficha de un vehículo con `pnpm build && pnpm start`; objetivo: Rendimiento ≥ 85, Accesibilidad ≥ 95, SEO ≥ 95, Mejores prácticas ≥ 95. Revisar LCP/CLS: tamaños de imagen (`sizes` correctos en `next/image`, `priority` solo en la primera imagen visible), fuentes (`display: swap`, subconjuntos), tamaño del JS del cliente (`pnpm build` + analizar con `@next/bundle-analyzer` solo de forma puntual; no dejarlo instalado si no se usa en CI). Pegar las cifras antes/después en las notas.
5. **Lighthouse en CI (opcional si es estable):** `lighthouse-ci` con presupuestos holgados solo si 3 ejecuciones seguidas dan resultados similares; si resulta intermitente, **no** añadirlo y dejar el comando documentado.
6. **Imágenes de `/media`:** confirmar que las fotos subidas se sirven con tamaños adecuados (miniaturas en tarjetas, principal en ficha) y que el `alt` de cada foto es descriptivo (marca, modelo, año y número de foto).

## Fuera de alcance

Rediseño visual, PWA, modo oscuro.

## Criterios de aceptación

- [x] La suite axe pasa en escritorio y móvil para todas las páginas listadas.
- [x] Un solo `banner` y un solo `main` visibles con y sin sesión (o documentada la causa con evidencia).
- [x] Lighthouse con las cifras objetivo en portada, catálogo y ficha (o justificación por cada una que no se cumpla).
- [x] `pnpm check`, `pnpm build` y `pnpm test:e2e` pasan; CI en verde.

## Recordatorio de proceso

Rama `issue/<ID>-<slug>` **creada desde `main` actualizado** (`git checkout main && git pull`), nunca encadenada sobre otra rama sin fusionar. PR al terminar y estado `REVIEW`. **No fusionar ni marcar `DONE`.** Las pruebas que usan la BD real se llaman `*.db.test.ts`; los e2e usan datos propios (nunca “la primera tarjeta” ni conteos globales) y no dejan residuos. Antes de empujar: `pnpm check`, `pnpm build` y `pnpm test:e2e` varias veces seguidas. Si el job E2E del CI falla en “Install Playwright system dependencies” es la red de `apt`: `gh run rerun --failed`. Texto visible en `site-content.ts`, sin afirmaciones comerciales inventadas. **Lee `AGENTS.md` y la documentación local de Next antes de escribir código.**

## Notas de entrega

**axe-core:** `e2e/accesibilidad.spec.ts` (`@axe-core/playwright` 4.14.0 fijada): 24 páginas × 2 viewports (1280 y 360 px) = 48 pruebas, WCAG 2.1 A/AA, falla con `serious`/`critical`, **sin excepciones**. Primera pasada: **14 fallos**, todos `color-contrast` del mismo origen: texto blanco sobre el verde de marca de WhatsApp `#25D366` (contraste 1,98:1) en el botón de la cabecera, el menú móvil, el botón flotante, `/contacto` y `/proximamente`. Corregido con el verde ya usado en `ReserveCta` (`#0e7c42`, hover `#0b6637`; difieren de `DESIGN.md`, como la decisión previa de F1-06). Los iconos verdes sin texto no se tocaron.

**Teclado (`e2e/teclado.spec.ts`, 10 pruebas):** menú de usuario, menú móvil, galería ampliada, confirmaciones (`<details>`), subida de fotos solo con teclado, navegación del panel y `prefers-reduced-motion`. Defectos encontrados y corregidos:

- Los diálogos con `aria-modal="true"` (menú móvil y galería) **no atrapaban el foco**: con Tab se salía a la página de detrás. Nuevo `useFocusTrap` (comprobado por mutación: sin él la prueba falla en el 10.º Tab).
- En la ficha, las flechas ←/→ cambiaban la foto aunque se estuviera escribiendo en un campo (p. ej. el buscador de la cabecera); ahora se ignoran dentro de `input`/`textarea`/`select`.
- Sin `prefers-reduced-motion`: añadido en `globals.css` (anula animaciones y transiciones).
  El foco vuelve al origen al cerrar con Escape o con el botón (ya ocurría; ahora hay prueba).

**Duplicado oculto de `<header>`/`<main>` con sesión — causa raíz:** no es del streaming de la carcasa ni de la sesión. Tras cualquier navegación en el cliente (p. ej. iniciar sesión y pasar de `/login` a `/`) Next 16 conserva la ruta anterior con `<Activity>` en `<div style="display: none !important">`, hijo directo de `<body>` (reproducido con un volcado del DOM: `HEADER … <- DIV[style=display: none !important]`). Está documentado como comportamiento del framework en `node_modules/next/dist/docs/01-app/02-guides/preserving-ui-state.md` («Activity keeps the DOM in the document (hidden with `display: none`)»). `display: none` lo saca del árbol de accesibilidad. Prueba nueva: tras iniciar sesión y navegar por 3 páginas, `getByRole('banner'/'main')` = 1 y los `header`/`main` no ocultos = 1 y 1; igual para visitante.

**Lighthouse móvil** (`pnpm build && pnpm start`, Lighthouse 12, Chromium headless, mediana de 3 ejecuciones):

| Ruta           |         | Rend. | Accesib. | Buenas prác. |    SEO |     LCP | CLS |   TBT |
| -------------- | ------- | ----: | -------: | -----------: | -----: | ------: | --: | ----: |
| `/`            | antes   |    99 |      100 |          100 |    100 | 2187 ms |   0 | 20 ms |
|                | después |    99 |      100 |          100 |    100 | 2189 ms |   0 | 18 ms |
| `/catalogo`    | antes   |    93 |      100 |          100 |    100 | 3181 ms |   0 | 22 ms |
|                | después |    93 |      100 |          100 |    100 | 3185 ms |   0 | 18 ms |
| `/vehiculos/1` | antes   |    93 |      100 |          100 | **92** | 3276 ms |   0 | 20 ms |
|                | después |    93 |      100 |          100 | **92** | 3194 ms |   0 | 16 ms |

Todos cumplen Rendimiento ≥ 85, Accesibilidad ≥ 95 y Buenas prácticas ≥ 95. **SEO 92 en la ficha** (< 95): igual que en F1-06, por la auditoría `meta-description` (el `<title>`/`<meta description>` llegan en el `<body>` por el streaming de `loading.tsx`); forzar `htmlLimitedBots: /.*/` retrasaría TTFB y LCP en todo el sitio, así que sigue sin aplicarse. Cambio de rendimiento: la primera tarjeta del catálogo y de «próximamente» pasa a `priority` (era la imagen LCP con `loading="lazy"`); su _load delay_ bajó de 2397 ms a 101 ms, pero el LCP no cambia porque lo domina el _render delay_ (~2,6 s) de contenido que llega por streaming bajo la limitación simulada (Slow 4G, CPU ×4); no se tocó la arquitectura. Fuentes ya con `display: swap` y subconjunto `latin`; el JS del cliente no se analizó con bundle-analyzer (no hizo falta: TBT 16–22 ms).

**Imágenes de `/media`:** las tarjetas usan la miniatura `_t.webp`, la ficha la principal; `sizes` correctos y `alt` «Marca Modelo Año - Foto N de M» (miniaturas «… - Miniatura N»), con prueba e2e.

**Lighthouse CI:** **no se añadió.** Las 3 ejecuciones locales son estables (±3 puntos en portada, idénticas en las otras), pero no he podido comprobar su estabilidad en los runners compartidos de CI y un presupuesto intermitente bloquearía PRs. Comando documentado en el README.

**Pruebas:** `pnpm check` (63 archivos, 627 pruebas), `pnpm build` (resumen de rutas idéntico al anterior), `pnpm test:e2e` ×3: 139/139 cada vez.

**A revisar**

- El verde de WhatsApp con texto blanco queda más oscuro que `DESIGN.md` (contraste 5,3:1 en lugar de 1,98:1); confirmar con el propietario (ya listado en `ISSUES/PENDIENTES-PROPIETARIO.md` si F5-04 está fusionada).
- SEO 92 en la ficha, aceptado como en F1-06.
- Se añadió `reservation()`/`sale()` a `TestData` (e2e/helpers.ts) para los datos de las pruebas.
