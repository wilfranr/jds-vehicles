# F1-06: SEO básico, errores y pruebas de cierre de la Fase 1

- **Estado:** REVIEW
- **Fase:** 1
- **Depende de:** F1-03, F1-04, F1-05
- **Prioridad:** Media

## Contexto

Cierre de la Fase 1: visibilidad en buscadores, páginas de error coherentes con el diseño y un recorrido de prueba de punta a punta. **Lee `AGENTS.md` y la documentación local de Next.**

## Alcance

1. `src/app/layout.tsx`: `metadata` base (`metadataBase` desde `NEXT_PUBLIC_SITE_URL`, plantilla de título `%s | JDS Vehículos`, descripción, `lang="es"`, `openGraph` y `twitter`, `icons`).
2. `src/app/sitemap.ts` (portada, catálogo, páginas informativas y cada vehículo visible no vendido) y `src/app/robots.ts` (permitir todo excepto `/api`, `/_design`; apuntar al sitemap).
3. Datos estructurados JSON-LD en el detalle: tipo `Vehicle` (o `Car`) con marca, modelo, año, kilometraje, combustible, transmisión, imagen y `offers` (`price`, `priceCurrency: COP`, `availability` según disponibilidad). Inyección segura (serializar con `JSON.stringify` y escapar `<`).
4. Páginas `not-found.tsx` global y `error.tsx`/`global-error.tsx` con el estilo del sistema de diseño, texto en español y enlaces de salida (catálogo, WhatsApp).
5. Imágenes: `next/image` con `sizes` correcto; la imagen LCP de la portada con `priority`.
6. Cabeceras de seguridad básicas en `next.config.ts` (`X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`/`frame-ancestors`, `Permissions-Policy`). Una CSP estricta se decide en la Fase 5; no añadir una que rompa Next ahora.
7. Pruebas de recorrido con **Playwright** (dependencia de desarrollo, solo Chromium) en `e2e/catalog.spec.ts`: portada → catálogo → aplicar filtro de condición → abrir detalle → comprobar CTA y galería → página inexistente da 404. Script `pnpm e2e`. Para CI, añadir un job aparte en `ci.yml` que levante MySQL, migre, siembre y ejecute `pnpm e2e` (puede ser opcional/`continue-on-error` hasta estabilizarlo; anotar la decisión).
8. Pasada de Lighthouse (móvil) en `/`, `/catalogo` y `/vehiculos/1`: registrar en las notas de entrega puntuaciones de rendimiento, accesibilidad, mejores prácticas y SEO. Meta: accesibilidad ≥ 95, SEO ≥ 95, rendimiento ≥ 85 en las 3. Si no se alcanza, anotar la causa.
9. Actualizar el `README.md` con la lista de rutas públicas y cómo correr e2e.

10. **Pendientes de la revisión de F1-03:**
    - `getFeaturedVehicles` (`src/server/catalog/queries.ts`) documenta una vida de caché ≤ 60 s pero no llama a `cacheLife`, así que dura los 15 min por defecto. Añadir `cacheLife('seconds')` (o el perfil equivalente que indique la documentación local de Next) y comprobar en el resumen de `pnpm build` que `/` ya no indica 15 m.
    - `getFilterOptions` incluye modelos cuyos únicos vehículos son `PROXIMAMENTE` (p. ej. Hilux en el selector de modelo del catálogo), y al elegirlos el listado sale vacío. Limitar las opciones a vehículos `DISPONIBLE`/`RESERVADO`.
    - El menú del header (F1-01) parte los textos en dos líneas a 1280 px ("Catálogo / Inventario", "Cómo Funciona"); ajustar para que quepan en una línea.

    - `src/app/(public)/page.tsx` tiene `title` y `description` de `metadata` escritos directamente (con las cifras provisionales del prototipo); moverlos a `site-content.ts` junto con el resto del texto editorial.
    - Los ids no válidos o vendidos de `/vehiculos/[id]` devuelven HTTP 200 con la pantalla de no encontrado y `noindex` (consecuencia del streaming). Comprobar en `sitemap.ts` que esas URL no se listan; si se quiere un 404 real, evaluar quitar el `loading.tsx` de esa ruta y documentar el compromiso.

## Fuera de alcance

CSP estricta, analítica, cookies/consentimiento, internacionalización.

## Criterios de aceptación

- [x] `/sitemap.xml` y `/robots.txt` responden y listan lo esperado (sin vehículos vendidos ni ocultos).
- [ ] El JSON-LD del detalle valida (Google Rich Results Test o `schema.org` validator; pegar el resultado en las notas). _Pendiente: no se ejecutó el validador externo; ver notas._
- [x] 404 y errores usan el diseño del sitio.
- [x] `pnpm e2e` pasa en local con BD sembrada.
- [x] Puntuaciones de Lighthouse registradas y dentro de la meta o justificadas.
- [x] `pnpm check` y `pnpm build` pasan; CI en verde. _(CI pendiente de verse al abrir el PR.)_

## Verificación

```bash
pnpm build && pnpm start &
curl -s localhost:3000/sitemap.xml | head
curl -s localhost:3000/robots.txt
pnpm e2e
```

## Notas de entrega

### Qué se hizo

1. **Metadatos base** (`src/app/layout.tsx`): `metadataBase` desde `NEXT_PUBLIC_SITE_URL` (`src/lib/site-url.ts`), plantilla `%s | JDS Vehículos`, descripción, `openGraph`, `twitter`, `icons`. Los títulos de página ya no repiten el sufijo (lo pone la plantilla). Todo el texto vive en `site-content.ts` (`seo`, `errorPages`, `catalogMetaTitle`, `catalogResultsHeading`); la portada usa `title.absolute` desde ahí.
2. **`sitemap.ts` y `robots.ts`**: portada, catálogo, informativas y vehículos visibles no vendidos (`getSitemapVehicles`, cacheada 1 h). `robots` permite todo salvo `/api` y `/_design` y apunta al sitemap.
3. **JSON-LD** `Car` en el detalle (`src/lib/structured-data.ts`, con pruebas): marca, modelo, año, kilometraje, combustible, transmisión, cilindraje, imágenes y `offers` (COP, disponibilidad: `InStock`/`LimitedAvailability`/`PreOrder`). Se serializa con `JSON.stringify` escapando `<`, U+2028 y U+2029. No incluye la placa.
4. **Errores**: `not-found.tsx`, `error.tsx` y `global-error.tsx` con `ErrorScreen` (estilo del sistema, español, enlaces a catálogo y WhatsApp).
5. **Imágenes**: la primera tarjeta de la portada usa `priority` (nueva prop de `VehicleCard`); `sizes` ya estaba correcto en el resto.
6. **Cabeceras de seguridad** en `next.config.ts` (`X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options: DENY`, `Permissions-Policy`). Sin CSP.
7. **Playwright** (`@playwright/test`, solo Chromium): `playwright.config.ts`, `e2e/catalog.spec.ts` (portada → catálogo → filtro de condición → detalle → CTA y galería; JSON-LD; 404; sitemap/robots) y script `pnpm e2e`. **CI**: job `e2e` aparte en `ci.yml` con MySQL, migración, seed y build, marcado `continue-on-error: true` hasta estabilizarlo (decisión anotada en el propio job). Pendiente de confirmar en la primera ejecución real en GitHub.
8. **README**: lista de rutas públicas y cómo correr e2e.
9. **Pendientes de F1-03**:
   - `getFeaturedVehicles` y `getFilterOptions` ahora llaman a `cacheLife({ stale: 300, revalidate: 60, expire: 600 })`. No se usó el perfil `seconds` porque su `expire` de 1 min saca la ruta del prerenderizado (doc local de `cacheLife`). `pnpm build` muestra `/  1m  10m` (antes 15 m).
   - `getFilterOptions` limita las opciones a vehículos `DISPONIBLE`/`RESERVADO` (con prueba: un modelo solo `PROXIMAMENTE` no aparece).
   - Menú del header: `whitespace-nowrap` y menos relleno horizontal; medido a 1280 px, los cuatro enlaces ocupan una línea y no hay desbordamiento horizontal.
   - `title`/`description` de la portada movidos a `site-content.ts`.
   - Ids no válidos o vendidos de `/vehiculos/[id]`: el sitemap no los lista (prueba incluida). Se evaluó quitar `loading.tsx` para obtener un 404 real: **no es posible** con `cacheComponents` (el build falla con «uncached or runtime data during prerendering»). Se mantiene el compromiso: HTTP 200 con la pantalla de no encontrado y `noindex`.

### Lighthouse (móvil, `pnpm start`, Lighthouse 12, Chrome headless)

| Ruta           | Rendimiento | Accesibilidad | Buenas prácticas | SEO |
| :------------- | ----------: | ------------: | ---------------: | --: |
| `/`            |          95 |           100 |              100 | 100 |
| `/catalogo`    |          94 |           100 |              100 | 100 |
| `/vehiculos/1` |          94 |           100 |              100 |  92 |

Causa del SEO 92 en `/vehiculos/1`: auditoría `meta-description`. Por el streaming de metadatos (necesario por `loading.tsx`), `<title>` y `<meta description>` llegan en el `<body>` y no en `<head>`. La documentación local indica que Googlebot los interpreta bien y los bots sin JavaScript reciben los metadatos en `<head>`. Forzar `htmlLimitedBots: /.*/` lo evitaría pero retrasa el TTFB y el LCP en todo el sitio; no se aplicó.

### Desviaciones y decisiones para el propietario

- **Colores por accesibilidad** (Lighthouse marcaba contraste insuficiente): se oscurecieron los textos de las etiquetas de estado en `globals.css` (`nuevo` #047857, `seminuevo` #0e7490, `reservado` #b45309, `vendido` #475569) y el verde de los botones de WhatsApp de `ReserveCta` (#0e7c42). Difieren de los valores de `docs/DESIGN.md` (p. ej. `#059669`, `#25D366`); si se prefiere mantener el diseño original, hay que aceptar un contraste inferior a 4.5:1.
- **JSON-LD sin validar externamente**: no se envió la URL ni el HTML a servicios externos (Rich Results Test, validator.schema.org). Está cubierto por pruebas unitarias y se revisó a mano la salida de `/vehiculos/1`; conviene validarlo con la URL pública en la Fase 6.
- Se añadió `h2` oculto («Resultados del catálogo») para corregir el orden de encabezados del catálogo.
- El e2e usa los datos del seed de demostración (vehículos nuevos con fotos); necesita BD sembrada.

### Verificación

```bash
pnpm check && pnpm build
pnpm exec playwright install chromium   # solo la primera vez
pnpm e2e
pnpm start -p 3000 &
curl -s localhost:3000/sitemap.xml | head
curl -s localhost:3000/robots.txt
```
