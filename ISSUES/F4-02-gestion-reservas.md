# F4-02: Gestión de reservas (personal)

- **Estado:** TODO
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

- [ ] Cancelar una reserva de prueba la deja `CANCELADA` y el vehículo `DISPONIBLE` (y el catálogo lo refleja sin esperar 60 s).
- [ ] Dos personas cancelando a la vez: una cancela y la otra ve un aviso claro.
- [ ] `pnpm check`, `pnpm build` y `pnpm test:e2e` pasan; CI en verde.

## Recordatorio de proceso

Rama `issue/<ID>-<slug>` **creada desde `main` actualizado** (`git checkout main && git pull`), nunca encadenada sobre otra rama sin fusionar; si dependes de un issue que aún no está en `main`, espera. PR al terminar y estado `REVIEW`. **No fusionar ni marcar `DONE`.** Texto visible en `site-content.ts`, sin afirmaciones comerciales inventadas. **Lee `AGENTS.md` y la documentación local de Next antes de escribir código.**
