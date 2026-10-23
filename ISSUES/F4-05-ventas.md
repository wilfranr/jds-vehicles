# F4-05: Registro de ventas y cierre de reservas

- **Estado:** TODO
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

- [ ] Registrar la venta de una reserva de prueba deja: reserva `COMPLETADA`, vehículo `VENDIDO` y fuera del catálogo y de la ficha pública (404), y una fila en `ventas`.
- [ ] El doble envío no crea dos ventas.
- [ ] `pnpm check`, `pnpm build` y `pnpm test:e2e` pasan; CI en verde.

## Recordatorio de proceso

Rama `issue/<ID>-<slug>` **creada desde `main` actualizado** (`git checkout main && git pull`), nunca encadenada sobre otra rama sin fusionar; si dependes de un issue que aún no está en `main`, espera. PR al terminar y estado `REVIEW`. **No fusionar ni marcar `DONE`.** Texto visible en `site-content.ts`, sin afirmaciones comerciales inventadas. **Lee `AGENTS.md` y la documentación local de Next antes de escribir código.**
