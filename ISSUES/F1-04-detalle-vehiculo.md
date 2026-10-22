# F1-04: Detalle de vehículo con galería

- **Estado:** TODO
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

- [ ] `/vehiculos/1` (Corolla) y `/vehiculos/2` (CX-30) renderizan con el seed; `/vehiculos/999` y `/vehiculos/abc` dan 404.
- [ ] Un vehículo que se marque `VENDIDO` o `visible_catalogo=false` en BD devuelve 404.
- [ ] La galería funciona con teclado y lector de pantalla (rol, `aria-label`, texto alternativo descriptivo).
- [ ] Ninguna página expone la placa completa en el HTML (comprobar con `curl | grep`).
- [ ] Lighthouse accesibilidad ≥ 95 y sin scroll horizontal a 360 px.
- [ ] Tests: `ReserveCta` en los tres estados, galería (navegación y límites), similares.
- [ ] `pnpm check` y `pnpm build` pasan.

## Verificación

```bash
pnpm db:seed && pnpm dev
curl -s localhost:3000/vehiculos/2 | grep -c "ABC123"   # debe ser 0
```
