# F3-02: Reservar desde el detalle y abrir WhatsApp

- **Estado:** DONE
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

- [x] Con el cliente demo, reservar el Corolla crea la fila, deja el vehículo `RESERVADO` y lleva a la página de confirmación con el código `RES-AAAA-XXXX`; el catálogo ya lo muestra como reservado.
- [x] Dos navegadores reservando el mismo auto a la vez: uno confirma y el otro ve el mensaje de "ya reservado" (sin error 500).
- [x] El enlace de WhatsApp contiene el código, la marca/modelo y el nombre; no contiene la placa ni el documento.
- [x] Funciona sin JavaScript. Manipular `userId`/`vehicleId` en el cuerpo no permite reservar para otro usuario ni un vehículo no disponible o vendido.
- [x] `pnpm check` y `pnpm build` pasan en local; CI: ver el PR.

## Verificación

`pnpm dev`: reservar con el cliente demo; restaurar el estado de los datos del seed al terminar (`pnpm db:seed -- --demo` o SQL documentado en las notas).

## Recordatorio de proceso

Rama `issue/F3-02-reservar-whatsapp` + PR; al terminar, estado `REVIEW`. **No fusionar ni marcar `DONE`.**

## Notas de entrega

**Rama apilada:** esta rama parte de `issue/F3-01-servicio-reservas` (PR #29, aún sin fusionar) y el PR apunta a esa rama; al fusionar F3-01, GitHub lo reapunta a `main`. Para F3-01 añadí en este tramo: `already_reserved_by_you` devuelve ahora el `codigoReserva` existente (hace falta para llevar al usuario a su reserva).

**Qué se hizo**

- `src/app/(public)/vehiculos/[id]/actions.ts`: `reserveVehicleAction`; la lógica es `submitReservation` (`src/server/reservations/submit-reservation.ts`, inyectable). Orden probado: sesión vigente (`getFreshUser`) → validación de `vehicleId` (regla estricta ya extraída a `src/lib/vehicle-id.ts`; la página la reexporta) → límite → servicio. Del formulario solo se lee `vehicleId`; el usuario sale de la sesión.
- Límite de reservas: 10 intentos por hora y por usuario (`checkReserveAllowed` / `recordReserveAttempt` en `limiters.ts`), con el mensaje genérico `auth.tooManyAttempts`.
- Resultados: `created` → guarda `whatsappLink` y redirige a `/mi-cuenta/reservas/<codigo>?nueva=1`; `already_reserved_by_you` → a esa reserva (sin `?nueva`); `limit_reached` → mensaje con enlace «Ver mis reservas»; `inactive_user` o usuario desactivado → `signOut` y `/login` (como F2-05); `not_available` → refresca la caché y la ficha pasa a «Reservado». Si falla guardar el enlace, la reserva confirmada igualmente redirige (se reconstruye en F3-03).
- `src/lib/whatsapp.ts`: `buildReservationMessage` / `buildReservationWhatsAppUrl` (plantilla de la documentación en `site-content.ts` → `reservations.whatsappMessage`; valores en una línea y acotados a 100 caracteres; no se interpretan marcadores dentro de los valores). Nunca incluye placa ni documento.
- `ReserveCta` (DISPONIBLE con sesión): `ReserveForm` (cliente, `useActionState`), botón ámbar «Reservar este vehículo» con estado «Reservando…» y errores con `role="alert"`. El formulario solo envía `vehicleId`. Sin sesión sigue «Inicia sesión para reservar» y la reserva siempre exige un clic. El botón secundario de WhatsApp se mantiene.
- Caché: la acción pasa `invalidateCatalogFromAction` (`updateTag`).

**Tests:** `submit-reservation.test.ts` (orden, `userId` ignorado, 9 formatos de `vehicleId` inválidos, límite, cada resultado, fallo al guardar el enlace), mensaje de WhatsApp (plantilla, saneamiento, sin marcadores anidados, URL), límite de reservas y `VehicleDetail.test` actualizado (el formulario solo contiene `vehicleId`). Total 256 pruebas en verde.

**Verificado a mano** (build de producción, BD sembrada, dos navegadores con IP distinta): con cliente demo y un segundo usuario temporal pulsando «Reservar» a la vez sobre el Corolla, exactamente uno redirige a `/mi-cuenta/reservas/RES-2026-XXXX?nueva=1` y el otro permanece en la ficha sin error 500 (ver punto 1 de revisión); una sola fila, estado `PENDIENTE_CONTACTO`, `fecha_expiracion` a +48 h, vehículo `RESERVADO`; el enlace guardado contiene código, `Toyota Corolla` y nombre, sin placa ni documento; una visita anónima a `/vehiculos/1` ya muestra «Este vehículo se encuentra reservado» sin esperar los 60 s. Datos del seed restaurados (0 reservas, vehículo 1 `DISPONIBLE`, usuario temporal borrado).

**Para revisar**

1. **El perdedor de la carrera ve el panel «Este vehículo se encuentra reservado», no el texto «acaba de ser reservado por otra persona»:** al refrescar la caché la ficha re-renderiza con el vehículo ya `RESERVADO`, así que el formulario (y su mensaje) desaparece. Cumple el fondo (aviso claro, sin 500) y evita mostrar un botón obsoleto; si se prefiere ver el texto explícito, hay que omitir `refreshCatalog` en ese caso (la ficha quedaría desactualizada hasta 60 s). El mensaje `notAvailable` sí se usa si la caché no se refresca.
2. **`/mi-cuenta/reservas/<codigo>` aún no existe en esta rama** (lo crea F3-03): tras reservar, el destino da 404 hasta fusionar F3-03. La reserva y el enlace sí quedan guardados.
3. **Sin JavaScript** la ficha `/vehiculos/[id]` no se muestra (contenido en streaming bajo `loading.tsx`, limitación conocida desde F1/F2); el formulario en sí es un `<form action>` estándar de React y funciona sin JS cuando la página se entrega completa.
4. `reserveAvailableCta` («Consultar disponibilidad por WhatsApp») queda sin uso en componentes; no lo borré para no ampliar el alcance.

**Cómo verificar**: `pnpm check && pnpm build`; con `pnpm start` (`AUTH_TRUST_HOST=true`), iniciar sesión con `carlos.gomez@example.com` / `Cliente123*`, reservar `/vehiculos/1` y restaurar con `DELETE FROM reservas; UPDATE vehiculos SET disponibilidad='DISPONIBLE' WHERE id=1;`.
