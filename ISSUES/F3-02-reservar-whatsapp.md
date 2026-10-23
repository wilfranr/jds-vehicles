# F3-02: Reservar desde el detalle y abrir WhatsApp

- **Estado:** TODO
- **Fase:** 3
- **Depende de:** F3-01
- **Prioridad:** Alta

## Contexto

Flujo de `docs/DOCUMENTACION.md` §1.3: botón "Reservar este vehículo" → (si no hay sesión, login/registro) → se crea la reserva → el usuario es redirigido a `wa.me` con un mensaje que lleva el código. `ReserveCta` (F1-04/F2-03) hoy muestra para `DISPONIBLE` con sesión "Consultar disponibilidad por WhatsApp" con `TODO(F3)`. **Lee `AGENTS.md` y la documentación local de Next.**

## Alcance

1. **Server Action** `reserveVehicleAction(vehicleId)` (en el grupo de la ficha del vehículo):
   - Exige sesión con `getFreshUser()`; el id del usuario sale **de la sesión**, nunca del formulario. El `vehicleId` se valida con la misma regla estricta de `/vehiculos/[id]` (entero positivo ≤ 4294967295).
   - Limitador de F2-04: añadir un limitador de reservas por usuario (p. ej. 10 intentos por hora) siguiendo el patrón de `limiters.ts`; bloqueado → mensaje genérico de `auth.tooManyAttempts`-style en `site-content.ts`.
   - Llama a `createReservation` (F3-01) y traduce cada resultado a un mensaje claro: `not_available` ("Este vehículo acaba de ser reservado por otra persona"), `already_reserved_by_you` (llevar a la reserva existente), `limit_reached` (explicar el tope y enlazar a "Mis reservas"), `inactive_user` (cerrar sesión como en F2-05).
   - Con `created`: guardar el `whatsappLink` en la reserva y redirigir a **`/mi-cuenta/reservas/<codigo>?nueva=1`** (la página de confirmación de F3-03), **no** directamente a `wa.me`. Motivo: abrir WhatsApp automáticamente se puede bloquear (ventanas emergentes) y el usuario no vería su código; la página de confirmación muestra el botón verde grande "Abrir WhatsApp" y se abre además con un `<a>` normal (sin JavaScript).
2. **Mensaje de WhatsApp** (función pura en `src/lib/whatsapp.ts`, con test), tomado de la documentación: `Hola JDS Vehículos, he reservado el auto {Marca} {Modelo} (Código: {codigo}). Mi nombre es {Nombre} y deseo continuar con el proceso.` Número desde `getDealerConfig()`. Sanear los valores insertados (recortar longitud, quitar saltos de línea) y codificar con `buildWhatsAppUrl`.
3. **`ReserveCta`** para `DISPONIBLE` con sesión: botón principal ámbar (según `DESIGN.md`, "Secondary (Transaction / Reserve)") "Reservar este vehículo" que envía un `<form>` a la acción (funciona **sin JavaScript**), con estado de envío y mensajes de error con `role="alert"`. Mantener el botón secundario de WhatsApp para consultas. Sin sesión sigue "Inicia sesión para reservar" (`/login?next=/vehiculos/<id>`); tras iniciar sesión el usuario vuelve a la ficha (no reserva automáticamente: la reserva siempre exige un clic).
4. Actualizar los tests de `VehicleDetail`/`ReserveCta`. Tests de la acción con dependencias inyectadas: orden sesión → validación → límite → servicio; ignora un `userId` enviado en el formulario; cada resultado produce el mensaje esperado.
5. Después de reservar, la ficha del vehículo debe mostrar el estado `RESERVADO` (comprobar que la invalidación de caché de F3-01 funciona de punta a punta, sin esperar los 60 s).

## Fuera de alcance

Listado de reservas y página de detalle (F3-03), cancelación por el usuario (la documentación asigna cancelar/completar al personal), pagos.

## Criterios de aceptación

- [ ] Con el cliente demo, reservar el Corolla crea la fila, deja el vehículo `RESERVADO` y lleva a la página de confirmación con el código `RES-AAAA-XXXX`; el catálogo ya lo muestra como reservado.
- [ ] Dos navegadores reservando el mismo auto a la vez: uno confirma y el otro ve el mensaje de "ya reservado" (sin error 500).
- [ ] El enlace de WhatsApp contiene el código, la marca/modelo y el nombre; no contiene la placa ni el documento.
- [ ] Funciona sin JavaScript. Manipular `userId`/`vehicleId` en el cuerpo no permite reservar para otro usuario ni un vehículo no disponible o vendido.
- [ ] `pnpm check` y `pnpm build` pasan; CI en verde.

## Verificación

`pnpm dev`: reservar con el cliente demo; restaurar el estado de los datos del seed al terminar (`pnpm db:seed -- --demo` o SQL documentado en las notas).

## Recordatorio de proceso

Rama `issue/F3-02-reservar-whatsapp` + PR; al terminar, estado `REVIEW`. **No fusionar ni marcar `DONE`.**
