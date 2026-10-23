# F3-04: Expiración de reservas

- **Estado:** DONE
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

- [x] Con una reserva vencida de prueba, el script la marca `EXPIRADA` y el auto vuelve a `DISPONIBLE`; una segunda ejecución no hace nada.
- [x] Con `RESERVA_EXPIRACION_HORAS=0` (o filas con `fechaExpiracion = null`) nada expira.
- [x] `pnpm check` y `pnpm build` pasan en local; CI: ver el PR.

## Recordatorio de proceso

Rama `issue/F3-04-expiracion-reservas` + PR; al terminar, estado `REVIEW`. **No fusionar ni marcar `DONE`.**

## Notas de entrega

**Rama apilada:** parte de `issue/F3-01-servicio-reservas` (PR #29, aún sin fusionar; usa `ACTIVE_STATES` y la configuración de expiración de F3-01). El PR apunta a esa rama y GitHub lo reapunta a `main` al fusionar.

**Qué se hizo**

- `src/server/reservations/expire.ts`: `expireReservations(now, { db, invalidateCache?, logEvent? })`, en una transacción: lee las `PENDIENTE_CONTACTO` con `fechaExpiracion <= now` (las `null` nunca), las marca `EXPIRADA` (el estado se vuelve a exigir en el `UPDATE`, para no pisar un cambio concurrente) y devuelve cada vehículo a `DISPONIBLE` solo si sigue `RESERVADO` y no tiene otra reserva activa (`reservas: { none: { estado: { in: activos } } }`). No toca `EN_NEGOCIACION`, `COMPLETADA`, `CANCELADA` ni vehículos `VENDIDO`/`PROXIMAMENTE`. Idempotente. Tras confirmar, solo si expiró alguna: invalida caché (dependencia inyectable) y registra `reservations_expired` (`expired`, `vehiclesReleased`).
- `scripts/expire-reservations.ts` + `pnpm reservas:expirar` (`tsx`): imprime `{"expiradas":n,"vehiculosLiberados":m}` y sale con código 1 si falla (probado con valor inválido y con la BD caída). Con `RESERVA_EXPIRACION_HORAS=0` no hace nada (`"desactivada":true`). Sin ruta HTTP.
- README: sección «Expiración de Reservas» con la línea de `cron` de ejemplo (la programación real es de la Fase 6).

**Invalidación de caché desde un proceso aparte (investigado):** según la documentación local, `updateTag` solo funciona en Server Actions y `revalidateTag` en Server Functions/Route Handlers, es decir **dentro del servidor de Next**; un script de `cron` no puede invalidar la caché y la única vía sería una ruta HTTP, que el issue prohíbe. Se midió el efecto real contra `pnpm start`: tras ejecutar el script, la ficha (`/vehiculos/1`) y `/catalogo` mostraron el cambio **de inmediato** (2 s) porque `listVehicles` y `getVehicleById` no usan `'use cache'`. Solo se retrasan las consultas cacheadas: portada y filtros (~60 s) y «vehículos similares» (perfil por defecto, 15 min). Queda como se pide: el mecanismo es la caducidad de la caché, y está dicho en README y en el script. `expireReservations` acepta `invalidateCache` para cuando se llame desde un contexto de servidor (p. ej. una futura acción del panel en la Fase 4).

**Tests (12 nuevos; 242 en total en esta rama), BD sembrada con filas temporales 9401+ y reloj simulado:** vence/no vence (incluido el instante exacto `<=` y un segundo antes), idempotencia (la 2.ª pasada no invalida caché ni registra), `null` no expira ni en 2099, los 4 estados que no deben tocarse, otra reserva activa sobre el mismo vehículo (queda `RESERVADO`), vehículos `VENDIDO`/`PROXIMAMENTE` intactos, y varias reservas de distintos vehículos en una pasada.

**Verificado a mano contra la BD de desarrollo:** reserva vencida de prueba → `{"expiradas":1,"vehiculosLiberados":1}`, queda `EXPIRADA` y el Corolla `DISPONIBLE`; segunda ejecución `{"expiradas":0,…}`; con `RESERVA_EXPIRACION_HORAS=0` no cambia nada; datos restaurados (0 reservas, vehículo 1 `DISPONIBLE`).

**Para revisar:** el punto de `README` y del script sobre qué consultas son las cacheadas se basa en la medición de arriba; si en Fase 4 se cachea `listVehicles`/`getVehicleById`, habrá que revisarlo. El tope de 48 h y el cron cada 15 min son valores de ejemplo, no una decisión.

**Cómo verificar**: `pnpm db:seed && pnpm test`; insertar una reserva `PENDIENTE_CONTACTO` con `fecha_expiracion` pasada y el vehículo `RESERVADO`, ejecutar `pnpm reservas:expirar` dos veces y restaurar.
