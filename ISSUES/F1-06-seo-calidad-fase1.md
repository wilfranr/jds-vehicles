# F1-06: SEO básico, errores y pruebas de cierre de la Fase 1

- **Estado:** TODO
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

## Fuera de alcance

CSP estricta, analítica, cookies/consentimiento, internacionalización.

## Criterios de aceptación

- [ ] `/sitemap.xml` y `/robots.txt` responden y listan lo esperado (sin vehículos vendidos ni ocultos).
- [ ] El JSON-LD del detalle valida (Google Rich Results Test o `schema.org` validator; pegar el resultado en las notas).
- [ ] 404 y errores usan el diseño del sitio.
- [ ] `pnpm e2e` pasa en local con BD sembrada.
- [ ] Puntuaciones de Lighthouse registradas y dentro de la meta o justificadas.
- [ ] `pnpm check` y `pnpm build` pasan; CI en verde.

## Verificación

```bash
pnpm build && pnpm start &
curl -s localhost:3000/sitemap.xml | head
curl -s localhost:3000/robots.txt
pnpm e2e
```
