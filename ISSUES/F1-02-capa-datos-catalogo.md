# F1-02: Capa de datos del catálogo

- **Estado:** TODO
- **Fase:** 1
- **Depende de:** F0-08
- **Prioridad:** Alta (bloquea F1-03, F1-04, F1-05)

## Contexto

El catálogo lista los vehículos con `visible_catalogo = TRUE` (regla de `docs/DOCUMENTACION.md` §1.1) y permite filtrar por marca, modelo, precio, año, color y condición. Esta issue entrega solo la capa de servidor y sus tests; las pantallas vienen después. **Lee `AGENTS.md` y la documentación local de Next antes de empezar.**

## Alcance

1. Dependencia `zod`. `src/server/catalog/filters.ts`:
   - Esquema `catalogFiltersSchema` que parsea `searchParams` (strings) → objeto tipado y **nunca lanza**: valores inválidos se descartan o caen al valor por defecto.
   - Campos: `q` (texto, máx. 80), `marca` (id), `modelo` (id), `condicion` (`NUEVO|USADO`), `precioMin`, `precioMax`, `anioMin`, `anioMax`, `color`, `transmision`, `combustible`, `orden` (`recientes` por defecto, `precio_asc`, `precio_desc`, `anio_desc`), `pagina` (≥ 1), `disponibilidad` (ver abajo).
   - Si `precioMin > precioMax` (o años), intercambiarlos.
2. `src/server/catalog/queries.ts` (solo servidor, `import 'server-only'`):
   - `listVehicles(filters)` → `{ items: VehicleCardData[], total, page, pageSize, pageCount }`. Tamaño de página 12.
   - Siempre `visibleCatalogo: true`. El catálogo principal incluye `DISPONIBLE` y `RESERVADO` (los reservados se muestran con su badge); `PROXIMAMENTE` se lista con `disponibilidad=PROXIMAMENTE` (lo usa F1-05). `VENDIDO` nunca aparece.
   - Búsqueda `q`: coincidencia parcial en marca, modelo y color (y placa **no**: es un dato sensible).
   - `getVehicleById(id)` → `VehicleDetailData | null` con todas las fotos ordenadas por `ordenPresentacion` y la principal marcada. Devuelve `null` si no existe, está `VENDIDO` u oculto.
   - `getFilterOptions()` → marcas con sus modelos activos, colores distintos, rango de precio y de años presentes en el inventario visible. Se usa para poblar los controles de filtro.
3. **Tipos serializables:** `Decimal` y `Date` no deben cruzar a componentes cliente. Convertir `precio` a `number` (COP, sin decimales relevantes) y fechas a ISO string en los DTOs `VehicleCardData` y `VehicleDetailData` (definidos en `src/types/catalog.ts`). Nunca devolver `placa` completa al cliente: exponer solo los últimos 3 caracteres enmascarados (`***123`) y solo en detalle de usados.
4. Una consulta por listado: usar `include`/`select` para evitar N+1 (foto principal incluida).
5. Estrategia de caché según la documentación de esta versión de Next (Cache Components). Documentar en comentarios qué se cachea, con qué etiqueta y cómo se invalidará desde el panel en la Fase 4 (`revalidateTag`/equivalente). El listado con filtros puede ser dinámico; `getFilterOptions` es candidato a caché.
6. Tests de Vitest:
   - Parseo de filtros (entradas inválidas, extremos, intercambio de rangos, `pagina=-3`, `orden=zzz`).
   - Consultas contra la base de datos de pruebas: usar la BD de desarrollo con el seed demo **o** una BD aparte configurada por `DATABASE_URL_TEST` (preferible). Si se opta por BD real, los tests deben ser de solo lectura. Verificar: un `VENDIDO` o `visibleCatalogo=false` nunca aparece, paginación correcta, `getVehicleById` devuelve `null` en esos casos.
   - Si CI necesita datos, sembrar con `pnpm db:seed` en el workflow (ajustar `ci.yml`).

## Fuera de alcance

Interfaz, SEO, creación/edición de vehículos (Fase 4).

## Criterios de aceptación

- [ ] Ningún valor de `searchParams` arbitrario produce un error 500 (probar con fuzz sencillo en tests).
- [ ] Ningún vehículo `VENDIDO` ni oculto sale por ninguna función.
- [ ] Los DTOs son JSON-serializables (test que haga `JSON.parse(JSON.stringify(x))` y compare).
- [ ] La placa nunca viaja completa.
- [ ] `pnpm check` y `pnpm build` pasan; CI en verde.

## Verificación

```bash
pnpm test
pnpm db:seed && pnpm test src/server/catalog
```
