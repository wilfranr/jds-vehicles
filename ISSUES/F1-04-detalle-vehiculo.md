# F1-04: Detalle de vehículo con galería

- **Estado:** REVIEW
- **Fase:** 1
- **Depende de:** F1-02, F1-03
- **Prioridad:** Alta

## Contexto

Página de detalle (VDP) de `docs/DESIGN.md` ("Spec Badges"). En esta fase el botón de reserva **no** crea nada: la reserva real llega en la Fase 3 y necesita autenticación (Fase 2). **Lee `AGENTS.md` y la documentación local de Next.**

## Alcance

1. Ruta `/vehiculos/[id]` (servidor). Si `getVehicleById` devuelve `null` (no existe, vendido u oculto) → `notFound()`. Id no numérico → 404.
2. Galería: imagen principal grande con miniaturas, navegación con flechas y teclado (←/→), contador `1/N` con glassmorphism, ampliación a pantalla completa (diálogo accesible: foco atrapado, Esc cierra). Componente cliente aislado, lo demás en servidor. Con una sola foto o ninguna, degradar sin errores.
3. Información:
   - Título (marca + modelo + año), `StatusBadge` de condición y de disponibilidad, precio con `formatCOP`.
   - Fichas `SpecBadge` (micro-etiqueta + valor): año, kilometraje, transmisión, combustible, cilindraje, color, condición. Placa enmascarada solo en usados (ver F1-02).
   - Descripción (texto plano, conservar saltos de línea; **no** interpretar HTML).
4. Llamadas a la acción según disponibilidad:
   - `DISPONIBLE`: botón ámbar "Reservar este vehículo". Hasta que exista autenticación, el botón lleva a `/login?next=/vehiculos/[id]` **solo si esa ruta existe**; mientras no exista, mostrarlo como enlace a WhatsApp ("Consultar por WhatsApp") con mensaje prellenado con marca, modelo y año, y dejar `TODO(F3)` donde irá la reserva. Aislar esta decisión en un componente `ReserveCta` para cambiarla en la Fase 3 sin tocar la página.
   - `RESERVADO`: mensaje "Este vehículo está reservado" y CTA a WhatsApp para consultar por alternativas.
   - `PROXIMAMENTE`: etiqueta de preventa y CTA de WhatsApp "Preguntar por este vehículo".
   - Botón secundario siempre presente: "Escribir por WhatsApp" (verde `#25D366`).
5. Sección "Vehículos similares": hasta 3 de la misma marca o rango de precio ±25 %, excluyendo el actual (función nueva en `src/server/catalog/queries.ts` con test).
6. Migas de pan (Inicio › Catálogo › Marca Modelo) y enlace "Volver al catálogo" que conserve los filtros previos cuando se llegue desde el listado (usar `Link` con los `searchParams` o `history` de forma segura; si no es posible, volver a `/catalogo`).
7. Metadatos por vehículo con `generateMetadata` (título, descripción, Open Graph con la foto principal). El resto del SEO estructurado se hace en F1-06.

## Fuera de alcance

Crear reservas, favoritos, compartir en redes, simulador de financiación.

## Criterios de aceptación

- [x] `/vehiculos/1` (Corolla) y `/vehiculos/2` (CX-30) renderizan con el seed; `/vehiculos/999` y `/vehiculos/abc` dan 404.
- [x] Un vehículo que se marque `VENDIDO` o `visible_catalogo=false` en BD devuelve 404.
- [x] La galería funciona con teclado y lector de pantalla (rol, `aria-label`, texto alternativo descriptivo).
- [x] Ninguna página expone la placa completa en el HTML (comprobar con `curl | grep`).
- [x] Lighthouse accesibilidad ≥ 95 y sin scroll horizontal a 360 px.
- [x] Tests: `ReserveCta` en los tres estados, galería (navegación y límites), similares.
- [x] `pnpm check` y `pnpm build` pasan.

## Verificación

```bash
pnpm db:seed && pnpm dev
curl -s localhost:3000/vehiculos/2 | grep -c "ABC123"   # debe ser 0
```

## Notas de entrega

- **Ruta `/vehiculos/[id]`**: Creada con Server Components, fallback de carga `loading.tsx` compatible con streaming y Cache Components en Next.js 16, y boundary de error `not-found.tsx` ante IDs inexistentes, ocultos o vendidos.
- **Validación estricta de ID (`parseVehicleId`)**: Validación previa a consultas con `/^[1-9]\d{0,9}$/` y tope máximo `UNSIGNED INT` (4.294.967.295). Descarta y produce `notFound()` ante decimales (`1.5`), exponencial (`1e3`), negativos, no numéricos o desbordamientos de 64 bits (`99999999999999999999`). Incluye suite de pruebas unitarias específicas.
- **Galería interactiva (`VehicleGallery`)**: Componente cliente con soporte para miniaturas, navegación por teclado (`ArrowLeft` / `ArrowRight`), contador flotante con glassmorphism, y visor modal en pantalla completa accesible con foco atrapado y tecla `Escape`. Degrada limpiamente si no hay fotos.
- **Fichas y Metadatos**: Integración de `SpecBadge` con micro-etiquetas de especificaciones técnicas (cilindraje, transmisión, combustible, etc.) y enmascaramiento estricto de placa solo para usados (`***123`). Se removió la afirmación no autorizada de inspección pericial por unidad respetando las reglas de contenido de `ISSUES/README.md`.
- **Llamadas a la acción (`ReserveCta`)**: Ajustado el texto a "Consultar disponibilidad por WhatsApp" para unidades disponibles, y asegurada la presencia constante del botón secundario "Escribir por WhatsApp" en todos los estados (`DISPONIBLE`, `RESERVADO`, `PROXIMAMENTE`).
- **Vehículos similares (`getSimilarVehicles`)**: Implementada en `src/server/catalog/queries.ts` con caché `'use cache'`, consultando hasta 3 unidades coincidentes por marca o margen de precio ±25%.
- **Centralización**: Todo texto editorial de la página se movió a `siteContent.vehicleDetail` en `src/lib/site-content.ts`.
- **Pruebas y Calidad**: 11 tests unitarios en `src/components/catalog/VehicleDetail.test.tsx` (47 tests en toda la suite). `pnpm check` y `pnpm build` pasan sin errores. Verificado que `curl localhost:3000/vehiculos/2 | grep -c "ABC123"` devuelve `0`.
