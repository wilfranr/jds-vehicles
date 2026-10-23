# F4-02: Gestión de reservas (personal)

- **Estado:** REVIEW
- **Fase:** 4
- **Depende de:** F4-01
- **Prioridad:** Alta

## Contexto

`docs/DOCUMENTACION.md` §1.4: el personal marca la reserva `COMPLETADA` o `CANCELADA`; si se cancela o expira, el auto vuelve a `DISPONIBLE`. Las reservas nacen en `PENDIENTE_CONTACTO` (F3-01).

**Requisitos de seguridad comunes a toda la Fase 4:** (1) cada página y cada Server Action llama a `requireRole(...)` (además del proxy); el rol sale de la sesión/BD, nunca del formulario; (2) las acciones sensibles usan `getFreshUser()` (el JWT no se revoca); (3) listas explícitas de campos editables (nada de pasar el cuerpo del formulario a Prisma); (4) validación con Zod en servidor; (5) cada cambio relevante escribe un evento de auditoría de una línea JSON (quién, qué, id afectado; sin datos personales ni secretos); (6) los textos y avisos nunca revelan si un registro ajeno existe.

## Alcance

1. `/admin/reservas`: tabla paginada con código, cliente, vehículo, estado, fecha y vencimiento; filtros por estado y búsqueda por código o correo (consulta parametrizada, sin SQL crudo); por defecto, activas primero.
2. `/admin/reservas/[codigo]`: detalle con datos del cliente (nombre, teléfono, correo, ciudad; **no** hash ni documento completo: mostrar el documento enmascarado), el vehículo (con placa completa, es el personal), fechas, observaciones y un botón verde "Escribir al cliente por WhatsApp" (`wa.me` con el teléfono del cliente y un mensaje base en `site-content.ts`).
3. **Máquina de estados** en `src/server/reservations/transitions.ts` (función pura, probada): `PENDIENTE_CONTACTO → EN_NEGOCIACION | CANCELADA`; `EN_NEGOCIACION → CANCELADA` (`COMPLETADA` solo la produce F4-05 al registrar la venta, no un botón suelto). Estados finales no cambian. Cualquier otra transición se rechaza con un resultado tipado.
4. Server Actions `startNegotiationAction`, `cancelReservationAction(motivo)` en **una transacción**: actualizan la reserva con un `updateMany` condicionado al estado actual (si otro miembro del personal la cambió antes, se informa sin error 500) y, al cancelar, devuelven el vehículo a `DISPONIBLE` **solo si** sigue `RESERVADO` y no tiene otra reserva activa. Invalidar la caché del catálogo (misma técnica de F3-01).
5. Campo `observaciones` editable por el personal (texto limitado a 1000 caracteres, escapado al mostrarse) con registro de quién y cuándo en el evento de auditoría.
6. Textos en `site-content.ts`; chips de estado reutilizando los de F3-03.
7. **Tests:** transiciones válidas e inválidas, doble clic/concurrencia (dos cancelaciones simultáneas → una sola efectiva), el vehículo no se libera si hay otra reserva activa, autorización (CLIENTE 404; ASESOR y ADMIN permitidos), inyección en búsqueda y observaciones.

## Fuera de alcance

Registrar la venta (F4-05), reabrir reservas finales, notificaciones al cliente.

## Criterios de aceptación

- [x] Cancelar una reserva de prueba la deja `CANCELADA` y el vehículo `DISPONIBLE` (y el catálogo lo refleja sin esperar 60 s).
- [x] Dos personas cancelando a la vez: una cancela y la otra ve un aviso claro.
- [x] `pnpm check`, `pnpm build` y `pnpm test:e2e` pasan en local; CI: ver el PR.

## Recordatorio de proceso

Rama `issue/<ID>-<slug>` **creada desde `main` actualizado** (`git checkout main && git pull`), nunca encadenada sobre otra rama sin fusionar; si dependes de un issue que aún no está en `main`, espera. PR al terminar y estado `REVIEW`. **No fusionar ni marcar `DONE`.** Texto visible en `site-content.ts`, sin afirmaciones comerciales inventadas. **Lee `AGENTS.md` y la documentación local de Next antes de escribir código.**

## Notas de entrega

Rama desde `main` actualizado (sin encadenar; no depende de F4-03).

**Qué se hizo**

- **Máquina de estados** `src/server/reservations/transitions.ts` (pura): `PENDIENTE_CONTACTO → EN_NEGOCIACION | CANCELADA`, `EN_NEGOCIACION → CANCELADA`; `COMPLETADA` solo con `viaSale: true` (lo usará F4-05) desde un estado activo; `EXPIRADA` nunca a mano; los estados finales no cambian ni con una venta. Resultado tipado (`final_state | not_allowed | same_state`).
- **Servicio** `src/server/admin/reservations.ts`:
  - `listAdminReservations`: activas primero y luego el resto, cada tramo con su propia consulta paginada de 20 (no carga todo en memoria); filtro por estado; búsqueda parametrizada (Prisma, sin SQL crudo): por código si empieza por `RES-` y por correo en otro caso.
  - `getAdminReservation`: cliente (nombre, teléfono, correo, ciudad y **documento enmascarado: solo los 3 últimos caracteres**; nunca el hash), vehículo con placa completa, fechas y observaciones.
  - `changeReservationState`: **una transacción** que bloquea la fila de la reserva (`FOR UPDATE`), valida la transición, actualiza con `updateMany` condicionado al estado leído y, al cancelar, libera el vehículo **solo si** sigue `RESERVADO` y no tiene otra reserva activa. Dos personas a la vez: una cancela y la otra recibe `invalid_transition` sin error 500. El motivo se añade a las observaciones (`Cancelación: …`, tope de 1000 caracteres).
- **Server Actions** (`reservas/actions.ts`): `startNegotiationAction`, `cancelReservationAction` (motivo ≤ 300) y `saveNotesAction` (≤ 1000, texto plano). Cada una vuelve a llamar a `requireStaff()` (rol y cuenta activa confirmados en la BD); el **código llega enlazado desde la página y se revalida** (`parseReservationCode`), del formulario solo se lee el motivo o las observaciones. Auditoría con `logAdminEvent` (`reservation.negotiation_started | cancelled | notes_updated`; las observaciones **no** se escriben en el registro, solo quién y qué). Al cancelar se invalida la caché del catálogo (`updateTag`).
- **Páginas** `/admin/reservas` y `/admin/reservas/[codigo]`: chips de estado reutilizados de F3-03, botón verde «Escribir al cliente por WhatsApp» (`buildStaffContactUrl`: teléfono del cliente, plantilla en `site-content.ts`, valores saneados), cancelación en dos pasos (`<details>` con motivo opcional y confirmación). Las observaciones se muestran como valor de un `textarea` (React escapa; nunca se interpretan como HTML). Un panel cliente (`ReservationActionsPanel`) mantiene montados los avisos aunque el estado cambie.
- Textos en `site-content.ts` (`adminReservations`), README actualizado.

**Tests (+ 46):** transiciones (todas las combinaciones, finales, `viaSale`, `EXPIRADA`), esquemas de observaciones/motivo, enlace de WhatsApp al cliente, y con la BD (`reservations.db.test.ts`, 12): cancelar libera el vehículo y guarda el motivo, negociación sin tocar el vehículo, estados finales inmutables, `not_found`, **otra reserva activa mantiene el vehículo reservado**, **3 cancelaciones simultáneas → 1 efectiva y 2 `invalid_transition`**, detalle con documento enmascarado y sin hash, listado (activas primero, estado, código, correo), **cadenas de inyección** (`' OR 1=1 --`, `%`, `_`, `"; DROP TABLE reservas; --`) sin error ni filas ajenas y tabla intacta, observaciones con HTML guardadas literalmente, paginación sin repetir ni perder filas. **7 e2e** (`e2e/admin-reservas.spec.ts`): datos del cliente con documento enmascarado y WhatsApp al teléfono del cliente; iniciar negociación y cancelar con motivo, con el vehículo de vuelta en `/catalogo` al instante; **dos personas cancelando a la vez** (una ve «La reserva se canceló…», la otra el aviso de que ya no admite la acción); observaciones con `<img onerror>` mostradas como texto y límite de 1000; listado, filtros e inyección; **autorización** (CLIENTE 404, anónimo a login, código mal formado o ajeno → «no encontrado»); 360 px. `pnpm check` **340** pruebas (5 ejecuciones seguidas sin fallos), `pnpm test:e2e` **38** (3 ejecuciones), `pnpm build` en verde.

**Para revisar**

1. **Estado HTTP 200 con «no encontrado»** en `/admin/reservas/<código inexistente>` (página en streaming, como en F4-01/F4-03); no revela nada. Los códigos mal formados también se resuelven en la página.
2. **«COMPLETADA solo vía venta»:** `checkTransition(..., { viaSale: true })` queda disponible para F4-05; este issue no ofrece ese botón.
3. **Motivo de cancelación:** se guarda en `observaciones` (la tabla no tiene campo propio); si las observaciones ya ocupan 1000 caracteres, el motivo se recorta.
4. El filtro «Activas primero» (por defecto) ordena activas antes que finales; con un estado concreto filtra por él.
5. `AdminField` (F4-03) no existe en `main` todavía: este PR trae sus propios estilos mínimos de formulario en `ReservationActions.tsx` para no depender de otra rama.

**Cómo verificar**: `pnpm db:seed && pnpm check && pnpm build && pnpm test:e2e`; manualmente, crear una reserva con el cliente demo, entrar como ASESOR/ADMIN a `/admin/reservas`, cancelarla y comprobar el catálogo.
