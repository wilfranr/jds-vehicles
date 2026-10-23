# F5-02: Accesibilidad y rendimiento

- **Estado:** TODO
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

- [ ] La suite axe pasa en escritorio y móvil para todas las páginas listadas.
- [ ] Un solo `banner` y un solo `main` visibles con y sin sesión (o documentada la causa con evidencia).
- [ ] Lighthouse con las cifras objetivo en portada, catálogo y ficha (o justificación por cada una que no se cumpla).
- [ ] `pnpm check`, `pnpm build` y `pnpm test:e2e` pasan; CI en verde.

## Recordatorio de proceso

Rama `issue/<ID>-<slug>` **creada desde `main` actualizado** (`git checkout main && git pull`), nunca encadenada sobre otra rama sin fusionar. PR al terminar y estado `REVIEW`. **No fusionar ni marcar `DONE`.** Las pruebas que usan la BD real se llaman `*.db.test.ts`; los e2e usan datos propios (nunca “la primera tarjeta” ni conteos globales) y no dejan residuos. Antes de empujar: `pnpm check`, `pnpm build` y `pnpm test:e2e` varias veces seguidas. Si el job E2E del CI falla en “Install Playwright system dependencies” es la red de `apt`: `gh run rerun --failed`. Texto visible en `site-content.ts`, sin afirmaciones comerciales inventadas. **Lee `AGENTS.md` y la documentación local de Next antes de escribir código.**
