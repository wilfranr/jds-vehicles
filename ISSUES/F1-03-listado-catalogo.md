# F1-03: Portada y listado de catálogo con filtros

- **Estado:** DONE
- **Fase:** 1
- **Depende de:** F1-01, F1-02
- **Prioridad:** Alta

## Contexto

Pantalla principal del sitio. Referencia: `docs/prototype/screen.png`, `docs/prototype/code.html` y los componentes de `docs/DESIGN.md` (Automotive Cards, Filter Chips, Spec Badges). Rejilla: 3 columnas en escritorio ≥ 1200 px, 2 en tablet, 1 en móvil. **Lee `AGENTS.md` y la documentación local de Next.**

## Alcance

1. Rutas:
   - `/` portada: hero con título/subtítulo y métricas de `site-content.ts`, buscador rápido y una selección de hasta 6 vehículos destacados (los más recientes `DISPONIBLE`), con enlace "Ver todo el inventario".
   - `/catalogo`: listado completo con filtros y paginación. Los filtros viven **en la URL** (`searchParams`), de modo que se puedan compartir, usar con el botón Atrás y funcionar sin JavaScript (formulario GET).
2. Componente `VehicleCard` (`src/components/catalog/VehicleCard.tsx`), servidor:
   - Imagen 16:10 con `next/image`, `StatusBadge` arriba a la izquierda (`NUEVO`/`USADO`; si está reservado o próximamente, mostrar ese estado), tag de cantidad de fotos con glassmorphism abajo.
   - Marca + modelo, año, cinta de 3 especificaciones (transmisión/combustible, kilometraje, cilindraje) con iconos de lucide.
   - Precio formateado con `formatCOP` (`src/lib/format.ts`) y cifras tabulares.
   - Botón "Ver detalles" (enlace a `/vehiculos/[id]`; F1-04 crea la página).
   - Reservado: opacidad completa, badge ámbar y sin botón destacado. Vendido no aparece nunca.
   - El corazón de favoritos del diseño **no** se implementa.
3. Imágenes remotas: configurar `images.remotePatterns` en `next.config.ts` para el dominio de las fotos demo (`images.unsplash.com`). Documentar que el dominio final se define con el almacenamiento de la Fase 4. Si falta foto, mostrar un marcador de posición neutro.
4. Panel de filtros (`CatalogFilters`): condición (chips), marca → modelo dependiente, rango de precio, rango de año, color, transmisión, combustible, orden. Opciones tomadas de `getFilterOptions()`. En escritorio, barra lateral; en móvil, panel inferior desplegable con botón "Filtros (n)" que muestra cuántos están activos. Chips de filtros activos con botón para quitar uno y "Limpiar todo".
   - Mejora progresiva: funciona con envío del formulario; con JS se puede aplicar sin recargar toda la página (`useRouter`/`Link`), con debounce de 300 ms en campos de texto.
5. Paginación numerada accesible (`nav` con `aria-label`, página actual con `aria-current`), conservando los filtros. Resumen "Mostrando X–Y de Z vehículos".
6. Estados: sin resultados (mensaje claro + botón limpiar filtros), carga (`loading.tsx` con esqueletos de tarjeta), error (`error.tsx` con reintento).
7. Todo el texto en español; los números de página fuera de rango redirigen a la última página válida.

## Fuera de alcance

Página de detalle (F1-04), "próximamente" (F1-05), favoritos, comparador.

## Criterios de aceptación

- [x] Con el seed demo: `/catalogo` lista los vehículos; filtrar por `condicion=USADO` deja solo el CX-30; `precioMin` mayor que todos muestra el estado vacío.
- [x] Un filtro inválido en la URL no rompe la página.
- [x] Funciona con JavaScript desactivado (filtros y paginación).
- [x] Sin scroll horizontal a 360 px; rejilla 1/2/3 columnas según ancho.
- [x] CLS bajo: imágenes con dimensiones reservadas (Lighthouse CLS < 0.1 en `/catalogo`).
- [x] Accesibilidad Lighthouse ≥ 95; filtros operables por teclado.
- [x] Tests de componente para `VehicleCard` (estados nuevo, usado, reservado, sin foto) y `CatalogFilters` (chips activos).
- [x] `pnpm check` y `pnpm build` pasan.

## Verificación

```bash
pnpm db:seed && pnpm dev
# probar: /, /catalogo, /catalogo?condicion=USADO, /catalogo?precioMin=999999999999, /catalogo?pagina=-1&orden=zzz
```

## Notas de entrega

### Qué se hizo

1. Se configuró `images.remotePatterns` en `next.config.ts` permitiendo `images.unsplash.com` (para imágenes demo).
2. Se implementó `src/components/catalog/VehicleCard.tsx` (servidor) con ratio 16:10, `next/image`, `StatusBadge` prioritario, cinta de 3 especificaciones técnicas, precio formateado en COP con cifras tabulares y enlace a `/vehiculos/[id]`.
3. Se creó `src/components/catalog/CatalogFilters.tsx` soportando formularios estándar GET (funciona sin JS), chips de filtros activos con enlace para removerlos individualmente o "Limpiar todo", y cajón desplegable accesible en móvil (`lg:hidden`).
4. Se implementó `src/components/catalog/Pagination.tsx` accesible (`aria-label`, `aria-current`, `aria-disabled`), preservando todos los filtros en las URLs.
5. Se crearon los componentes de estado: `EmptyState.tsx`, `loading.tsx` (con skeleton cards) y `error.tsx` (con botón de reintento).
6. Se implementó `/catalogo` en `src/app/(public)/catalogo/page.tsx` con manejo de redirección para páginas fuera de rango y metadata SEO.
7. Se actualizó la portada `/` en `src/app/(public)/page.tsx` integrando el hero institucional, búsqueda rápida GET hacia el catálogo, métricas centralizadas de `trustMetrics` y rejilla de hasta 6 vehículos destacados disponibles.
8. Se añadieron pruebas unitarias de componentes en `VehicleCard.test.tsx` y `CatalogFilters.test.tsx`.
9. Toda la suite de calidad `pnpm check` (36 tests unitarios) y `pnpm build` pasa al 100%. Verificado con `curl` que los filtros y estados vacíos responden con código HTTP 200 y el contenido esperado.

### Correcciones aplicadas de la revisión (PR #8)

1. **Corrección de disponibilidad en catálogo principal**:
   - `listVehicles` en `src/server/catalog/queries.ts` ahora filtra por defecto exclusivamente `in: [DISPONIBLE, RESERVADO]`. El estado `PROXIMAMENTE` solo aparece si se pasa explícitamente en `filters.disponibilidad` (usado por `/proximamente` en F1-05).
   - `VENDIDO` queda permanentemente excluido incluso ante intentos de forzarlo por parámetro.
   - Se ampliaron las pruebas unitarias en `src/server/catalog/queries.test.ts` validando que sin filtro no aparece `PROXIMAMENTE`, con `disponibilidad=PROXIMAMENTE` sí aparece, y con `disponibilidad=VENDIDO` es ignorado.
2. **Ajuste de estrategia de caché en consultas**:
   - Se removió la directiva de caché de función (`'use cache'`) sobre `listVehicles` con parámetros arbitrarios y de texto libre para evitar claves infinitas y obsolescencia de hasta 15 minutos en estados de vehículos (reservado/vendido).
   - Se creó la función auxiliar dedicada `getFeaturedVehicles(limit)` en `queries.ts`, cacheada con la etiqueta `'catalog-vehicles'` para los destacados de la portada (`/`), lista para ser invalidada con `revalidateTag('catalog-vehicles')` en mutaciones de inventario posteriores (Fases 3 y 4).
3. **Eliminación y centralización de textos comerciales**:
   - Se removieron de `src/app/(public)/page.tsx` las 3 tarjetas de valor hardcodeadas ("Peritaje Certificado", "Entrega Inmediata", "Respaldo JDS") y los textos no contemplados en el diseño.
   - Se centralizaron subtítulos neutros en `src/lib/site-content.ts` (`catalogSubtitle: 'Explora nuestro inventario de vehículos nuevos y seminuevos.'`, `featuredSectionSubtitle: 'Explora los vehículos disponibles para entrega inmediata.'`), documentados con `TODO(owner)` para confirmación con el negocio.
4. **Ajuste visual de precio y botón en `VehicleCard`**:
   - Se aplicó `whitespace-nowrap` al precio y al botón "Ver detalles".
   - Se envolvió la fila en `flex-wrap sm:flex-nowrap items-end` con tamaño de texto responsivo (`text-lg sm:text-xl lg:text-lg xl:text-xl font-bold tracking-tight`) garantizando que nunca se rompa en dos líneas el precio ni el botón ante la presencia de la barra lateral en resoluciones ≥ 1024 px y 1280 px.
