# F3-04: Expiración de reservas

- **Estado:** TODO
- **Fase:** 3
- **Depende de:** F3-01
- **Prioridad:** Media (el plazo por defecto es 48 h, ver F3-01)

## Contexto

`docs/DOCUMENTACION.md` §1.4: "Si una reserva se cancela o expira, el auto retorna a estado `DISPONIBLE`". F3-01 deja `fechaExpiracion` opcional (plazo por defecto 48 h, `RESERVA_EXPIRACION_HORAS`). Aquí se implementa el proceso que **aplica** la expiración. **Lee `AGENTS.md` y la documentación local de Next.**

## Alcance

1. Función `expireReservations(now)` en `src/server/reservations/`: en una transacción, marca como `EXPIRADA` las reservas `PENDIENTE_CONTACTO` con `fechaExpiracion <= now` y devuelve el vehículo a `DISPONIBLE` **solo si** sigue `RESERVADO` y no tiene otra reserva activa. Idempotente (ejecutarla dos veces no cambia nada la segunda). No toca `EN_NEGOCIACION`, `COMPLETADA` ni `CANCELADA`, ni reservas con `fechaExpiracion = null`.
2. Invalidación de la caché del catálogo tras expirar al menos una (misma técnica que F3-01).
3. Punto de entrada **fuera del servidor web**: script `pnpm reservas:expirar` (`tsx`) pensado para el `cron` del servidor Oracle (Fase 6); imprime una línea JSON `{ expiradas: n }` y sale con código distinto de 0 si falla. No crear una ruta HTTP pública para esto; documentar en el README cómo programarlo (la invalidación de caché debe funcionar también desde un proceso aparte: investigar en la documentación local cómo se invalida la caché desde fuera del servidor y, si no es posible, dejar la caducidad de 60 s como mecanismo y **decirlo claramente** en las notas).
4. **Tests con reloj simulado:** vence/no vence, idempotencia, vehículo con otra reserva activa, estados que no deben tocarse, `null` no expira.

## Fuera de alcance

Elegir el plazo (decisión del propietario), avisos por correo o WhatsApp antes de expirar, cancelación manual (Fase 4).

## Criterios de aceptación

- [ ] Con una reserva vencida de prueba, el script la marca `EXPIRADA` y el auto vuelve a `DISPONIBLE`; una segunda ejecución no hace nada.
- [ ] Con `RESERVA_EXPIRACION_HORAS=0` (o filas con `fechaExpiracion = null`) nada expira.
- [ ] `pnpm check` y `pnpm build` pasan; CI en verde.

## Recordatorio de proceso

Rama `issue/F3-04-expiracion-reservas` + PR; al terminar, estado `REVIEW`. **No fusionar ni marcar `DONE`.**
