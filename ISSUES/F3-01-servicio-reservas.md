# F3-01: Servicio de reservas (dominio, transacción y concurrencia)

- **Estado:** TODO
- **Fase:** 3
- **Depende de:** F2-05
- **Prioridad:** Alta (bloquea el resto de la Fase 3)

## Contexto

`docs/DOCUMENTACION.md` §1.3: reservar crea una fila en `reservas` (usuario + vehículo), cambia el vehículo a `RESERVADO` y genera un código único (`RES-AAAA-XXXX`). La tabla `reservas` y el enum `EstadoReserva` (`PENDIENTE_CONTACTO`, `EN_NEGOCIACION`, `COMPLETADA`, `CANCELADA`, `EXPIRADA`) ya existen. Aquí se construye **solo la lógica de servidor, sin interfaz**. **Lee `AGENTS.md` y la documentación local de Next antes de escribir código.**

## Alcance

1. Módulo `src/server/reservations/` con una función `createReservation({ userId, vehicleId })` que, **dentro de una única transacción de Prisma**:
   - Verifica que el vehículo existe, es `DISPONIBLE`, `visible_catalogo = true` y no está vendido.
   - Cambia el vehículo a `RESERVADO` con un `updateMany` condicionado (`where: { id, disponibilidad: 'DISPONIBLE' }`) y comprueba `count === 1`: así, si dos usuarios reservan a la vez, **solo uno gana** y el otro recibe el resultado `not_available` (no un error 500). No basta con leer y luego escribir.
   - Crea la reserva en `PENDIENTE_CONTACTO` con `fechaExpiracion` según la configuración (punto 4).
   - Devuelve un resultado tipado (`created` | `not_available` | `already_reserved_by_you` | `limit_reached` | `inactive_user`), nunca lanza para casos de negocio.
2. **Código de reserva** `RES-AAAA-XXXX` (año de la reserva + 4 caracteres del alfabeto sin ambigüedad `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`), generado con `crypto.randomInt` (no `Math.random`). Reintentar ante colisión del índice único (hasta 5 veces). Función pura probada.
3. **Reglas de negocio** (probadas con la BD de pruebas o con el cliente simulado):
   - Un usuario no puede tener dos reservas activas (`PENDIENTE_CONTACTO` o `EN_NEGOCIACION`) del mismo vehículo → `already_reserved_by_you`.
   - **Tope de reservas activas por usuario** (evita que una cuenta bloquee el inventario): constante `MAX_ACTIVE_RESERVATIONS_PER_USER = 2` en un único lugar, `TODO(owner)`: el propietario debe confirmar el valor. Superado → `limit_reached`.
   - Solo usuarios `activo = true` (usar `getFreshUser()` de F2-01 en la acción, y comprobarlo también aquí).
4. **Expiración (configuración):** variable opcional `RESERVA_EXPIRACION_HORAS` (entero positivo). Si está definida, `fechaExpiracion = ahora + horas`; si no, `null` (sin expiración). **No inventar un plazo por defecto**: la documentación dice que una reserva puede expirar pero no cuánto dura (decisión pendiente del propietario). Documentarla en `.env.example` y el README, y validarla en `src/server/auth/env.ts`-style (si es inválida, fallar claro al arrancar).
5. Tras confirmar la transacción: invalidar la caché del catálogo con `revalidateTag('catalog-vehicles', …)` o `updateTag`, **según lo que indique la documentación local de Next 16** (la firma cambió; anotar en las notas cuál se usó y por qué). El servicio expone la invalidación como dependencia inyectable para poder probarlo sin Next.
6. Registro con `logSecurityEvent`-style de auditoría (una línea JSON, sin datos personales): `reservation_created` y `reservation_rejected` (con motivo).
7. **Tests:** código (formato, alfabeto, reintento por colisión), cada resultado del punto 1, tope por usuario, doble reserva, y una **prueba de concurrencia**: dos llamadas simultáneas (`Promise.all`) al mismo vehículo contra la BD de pruebas → exactamente una `created` y una `not_available`, con una sola fila en `reservas` y el vehículo `RESERVADO`.

## Fuera de alcance

Interfaz, Server Action pública, redirección a WhatsApp (F3-02), listado (F3-03), expiración automática (F3-04), gestión por el personal (Fase 4).

## Criterios de aceptación

- [ ] La prueba de concurrencia pasa de forma estable (ejecutarla 20 veces en un bucle y pegar el resultado en las notas).
- [ ] Una reserva fallida no deja el vehículo en `RESERVADO` ni filas huérfanas (transacción).
- [ ] No hay plazo de expiración por defecto; con `RESERVA_EXPIRACION_HORAS=24` la fila queda con `fechaExpiracion` a 24 h.
- [ ] `pnpm check` y `pnpm build` pasan; CI en verde.

## Verificación

`pnpm test` y un script de comprobación manual sobre la BD de desarrollo con filas temporales (ids 9001+) que se limpian al final. Restaurar el estado de los vehículos del seed.

## Recordatorio de proceso

Rama `issue/F3-01-servicio-reservas` + PR; al terminar, estado `REVIEW`. **No fusionar ni marcar `DONE`.** Texto visible en `site-content.ts`; sin afirmaciones comerciales inventadas.
