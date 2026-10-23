# F4-05: Registro de ventas y cierre de reservas

- **Estado:** REVIEW
- **Fase:** 4
- **Depende de:** F4-02
- **Prioridad:** Alta

## Contexto

`docs/DOCUMENTACION.md` §1.4: el personal registra la venta (vehículo, comprador, valor final pactado); la reserva queda `COMPLETADA` y el vehículo pasa a `VENDIDO` con `visible_catalogo = false`. La negociación ocurre fuera de la plataforma. Modelo `Venta` y enum `MetodoPago` (`TRANSFERENCIA`, `EFECTIVO`, `CREDITO`, `MIXTO`) ya existen.

**Requisitos de seguridad comunes a toda la Fase 4:** (1) cada página y cada Server Action llama a `requireRole(...)` (además del proxy); el rol sale de la sesión/BD, nunca del formulario; (2) las acciones sensibles usan `getFreshUser()` (el JWT no se revoca); (3) listas explícitas de campos editables (nada de pasar el cuerpo del formulario a Prisma); (4) validación con Zod en servidor; (5) cada cambio relevante escribe un evento de auditoría de una línea JSON (quién, qué, id afectado; sin datos personales ni secretos); (6) los textos y avisos nunca revelan si un registro ajeno existe.

## Alcance

1. Desde el detalle de una reserva `EN_NEGOCIACION` (F4-02): formulario "Registrar venta" con precio final (por defecto el precio del vehículo, editable), método de pago y observaciones. El **comprador es el usuario de la reserva** y el **vendedor es el usuario de la sesión** (ambos de servidor, nunca del formulario). También se permite desde `PENDIENTE_CONTACTO` pasando implícitamente por la negociación.
2. **Una sola transacción** (`registerSale`): reserva → `COMPLETADA`, vehículo → `VENDIDO` + `visible_catalogo = false`, fila en `ventas` con `numero_recibo_contrato` único generado en servidor (`VTA-AAAA-NNNNNN`, consecutivo anual sin huecos tolerados pero sin colisiones: reintento ante el índice único). Condiciones con `updateMany` (reserva en estado permitido y vehículo `RESERVADO`); doble envío o carrera → una sola venta, la otra recibe un aviso. Invalidar la caché del catálogo.
3. `/admin/ventas`: listado paginado (recibo, fecha, vehículo, comprador, vendedor, precio final, método) con filtro por rango de fechas y total del periodo (suma decimal exacta, sin flotantes); detalle de solo lectura. **Las ventas no se editan ni se borran** en esta fase.
4. Validación: precio final > 0 con 2 decimales máximo, método de pago del enum, observaciones ≤ 1000 caracteres.
5. **Tests:** transacción completa y su reversión ante fallo intermedio, concurrencia (dos registros simultáneos de la misma reserva → una venta), vehículo y reserva en estados inválidos, número de recibo único, total del periodo exacto, autorización, y que el comprador/vendedor enviados en el formulario se ignoran.

## Fuera de alcance

Facturación electrónica, contratos en PDF, anulación o edición de ventas, comisiones.

## Criterios de aceptación

- [x] Registrar la venta de una reserva de prueba deja: reserva `COMPLETADA`, vehículo `VENDIDO` y fuera del catálogo y de la ficha pública (404), y una fila en `ventas`.
- [x] El doble envío no crea dos ventas.
- [x] `pnpm check`, `pnpm build` y `pnpm test:e2e` pasan en local; CI: ver el PR.

## Recordatorio de proceso

Rama `issue/<ID>-<slug>` **creada desde `main` actualizado** (`git checkout main && git pull`), nunca encadenada sobre otra rama sin fusionar; si dependes de un issue que aún no está en `main`, espera. PR al terminar y estado `REVIEW`. **No fusionar ni marcar `DONE`.** Texto visible en `site-content.ts`, sin afirmaciones comerciales inventadas. **Lee `AGENTS.md` y la documentación local de Next antes de escribir código.**

## Notas de entrega

Rama desde `main` actualizado (sin encadenar; no depende de F4-04).

**Qué se hizo**

- **`registerSale`** (`src/server/admin/sales.ts`): **una sola transacción** que (0) toma una fila de exclusión mutua, (1) bloquea la reserva por código (`FOR UPDATE`), (2) valida con `checkTransition(…, 'COMPLETADA', { viaSale: true })` (admite `PENDIENTE_CONTACTO` y `EN_NEGOCIACION`; los estados finales dan `invalid_state`), (3) `updateMany` de la reserva condicionado al estado leído, (4) `updateMany` del vehículo condicionado a `RESERVADO` → `VENDIDO` + `visible_catalogo = false` y (5) crea la `Venta`. Si cualquier paso falla (vehículo no reservado, vendedor inexistente…) **se revierte todo** (probado: la reserva vuelve a `EN_NEGOCIACION`, el vehículo no cambia y no queda ninguna venta). **Comprador = usuario de la reserva; vendedor = usuario de la sesión**; la función ni siquiera acepta esos datos del formulario.
- **Recibo `VTA-AAAA-NNNNNN`** generado en el servidor: año calendario de Bogotá y consecutivo anual a partir del máximo existente del año; reintento ante el índice único. Un `FOR UPDATE` sobre un rango vacío toma bloqueos de hueco que **sí se interbloquean** (lo reproduje: _Deadlock found_ con ventas simultáneas), así que la generación se serializa con la fila de exclusión mutua (la última de `roles`, distinta de la de placas de F4-03) tomada lo primero, con el orden fijo mutex → reserva → vehículo; además hay reintento ante deadlock/`P2034`.
- **Server Action** `registerSaleAction` (`reservas/[codigo]/venta-actions.ts`): `requireStaff()` (rol y cuenta activa en la BD), el código llega enlazado y se revalida, del formulario solo se leen `precio`, `metodoPago`, `observaciones` y `confirmar` (la casilla se exige **en el servidor**). Zod: precio decimal exacto > 0 con 2 decimales como máximo y tope 9 999 999 999,99 (misma función que los vehículos), método del enum, observaciones ≤ 1000 de texto plano. Auditoría `sale.registered` con recibo, precio y método (datos del negocio; **nunca el comprador**) e invalidación de la caché del catálogo (`updateTag`). Redirige al recibo.
- **Formulario «Registrar venta»** en el detalle de la reserva (solo si el estado lo admite): precio por defecto = precio del vehículo (editable), método, observaciones, casilla. Se envía a mano (`onSubmit` + `startTransition`) en lugar de `<form action>` para que React **no reinicie el formulario** al volver un error y el usuario conserve lo escrito y la casilla (con `action` se perdía la casilla marcada).
- **`/admin/ventas`**: listado paginado de 20 (recibo, fecha, vehículo, comprador, vendedor, precio, método), filtro por **rango de fechas** (días de Bogotá, ambos extremos incluidos; rango inválido → aviso y se muestran todas), contador y **total del periodo como suma decimal exacta** (`aggregate` de Prisma sobre `Decimal`, mostrado con `formatExactCOP`, sin `Number`). **`/admin/ventas/[recibo]`** de solo lectura (recibo validado con patrón estricto; las observaciones se muestran como texto). Sin editar ni borrar.
- Utilidades nuevas: `day-range.ts` (días de Bogotá), `formatExactCOP` en `format.ts`, `lib/validation/sale.ts`.

**Pruebas (+ 106):** esquema de venta y recibo; rangos de fechas; `formatExactCOP`; acción con dependencias simuladas (vendedor de la sesión, **`compradorId`/`vendedorId` del formulario ignorados**, `requireStaff` primero, código mal formado, errores por campo, traducción de `invalid_state`/`vehicle_invalid`, auditoría sin datos personales); servicio con la BD (`sales.db.test.ts`, 14: transacción completa con comprador y vendedor correctos, desde `PENDIENTE_CONTACTO`, estados finales, **reversión** por vehículo inconsistente y por fallo inesperado, `not_found`, **3 registros simultáneos de la misma reserva → una venta**, **4 ventas simultáneas de reservas distintas → recibos únicos y consecutivos**, consecutivo por año, listado con suma decimal exacta 0,10 + 0,20 + 99,99 = 100,29 y filtros, detalle); las ventas de las pruebas llevan fecha de 2031 para no mezclarse con datos reales. **7 e2e** (`e2e/admin-ventas.spec.ts`): registrar la venta (reserva `COMPLETADA`, vehículo `VENDIDO` oculto, comprador/vendedor correctos, fuera de `/catalogo` y ficha pública «no encontrado», observaciones con HTML como texto), **doble envío con dos personas a la vez** (una venta y aviso claro), validación (el servidor exige la casilla; la casilla se conserva tras un error), reserva cancelada sin formulario, listado con rango de fechas y total exacto (`$ 0,30`) filtrando por ventas de 2031, **autorización** (CLIENTE 404, anónimo a login, recibos mal formados o inexistentes «no encontrado») y 360 px con el total más largo posible. `pnpm check` **537** pruebas (5 ejecuciones seguidas), `pnpm build` en verde y sin avisos, `pnpm test:e2e` **63/63** (4 ejecuciones seguidas).

**Para revisar**

1. **Exclusión mutua en `roles`:** dos ventas simultáneas se turnan (también con ventas de otras reservas). El coste es mínimo; si en el futuro hay mucho volumen convendría una tabla de secuencias (migración) en vez de una fila de `roles`.
2. **Estado HTTP 200 con «no encontrado»** en `/admin/ventas/<recibo inexistente>` (página en streaming, como en el resto del panel).
3. **Bug que cazó el e2e de 360 px:** con totales largos (`$ 187.000.000,50`) las tarjetas de resumen de dos columnas desbordaban la pantalla; ahora van en una columna en móvil y con `break-words`.
4. **Vehículo con `venta` y reservas finales:** al vender, otras reservas del mismo vehículo (no debería haberlas: el servicio de reservas lo impide) no se tocan.
5. `SaleFormState.values` se sigue devolviendo desde la acción pero la interfaz ya no lo necesita (los campos son controlados); lo dejé porque las pruebas de la acción lo comprueban.
6. El `PENDIENTE_CONTACTO → venta` directo registra solo el cambio a `COMPLETADA` (no pasa por `EN_NEGOCIACION` en la BD), como pide el issue («implícitamente»).

**Cómo verificar**: `pnpm db:seed && pnpm check && pnpm build && pnpm test:e2e`; manualmente, con el cliente demo reservar el Corolla, como ASESOR abrir la reserva en `/admin/reservas`, «Registrar venta», comprobar `/admin/ventas`, que `/vehiculos/1` da «no encontrado» y restaurar con `pnpm db:seed` (+ `DELETE FROM ventas; DELETE FROM reservas;`).
