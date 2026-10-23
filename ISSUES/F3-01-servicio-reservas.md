# F3-01: Servicio de reservas (dominio, transacción y concurrencia)

- **Estado:** DONE
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
   - **Tope de reservas activas por usuario** (evita que una cuenta bloquee el inventario): constante `MAX_ACTIVE_RESERVATIONS_PER_USER = 2` en un único lugar (valor elegido por el orquestador por delegación del propietario para el demo; `TODO(owner)`: confirmar antes de producción). Superado → `limit_reached`.
   - Solo usuarios `activo = true` (usar `getFreshUser()` de F2-01 en la acción, y comprobarlo también aquí).
4. **Expiración (configuración):** variable `RESERVA_EXPIRACION_HORAS` (entero positivo). **Decisión del propietario (demo): 48 horas por defecto**, definida como constante en un único lugar (`DEFAULT_RESERVATION_EXPIRY_HOURS = 48`, `TODO(owner)`: confirmar antes de producción). La variable, si existe, tiene prioridad; el valor `0` desactiva la expiración (`fechaExpiracion = null`). Documentarla en `.env.example` y el README, y validarla al arrancar (si es inválida, fallar con un mensaje claro).
5. Tras confirmar la transacción: invalidar la caché del catálogo con `revalidateTag('catalog-vehicles', …)` o `updateTag`, **según lo que indique la documentación local de Next 16** (la firma cambió; anotar en las notas cuál se usó y por qué). El servicio expone la invalidación como dependencia inyectable para poder probarlo sin Next.
6. Registro con `logSecurityEvent`-style de auditoría (una línea JSON, sin datos personales): `reservation_created` y `reservation_rejected` (con motivo).
7. **Tests:** código (formato, alfabeto, reintento por colisión), cada resultado del punto 1, tope por usuario, doble reserva, y una **prueba de concurrencia**: dos llamadas simultáneas (`Promise.all`) al mismo vehículo contra la BD de pruebas → exactamente una `created` y una `not_available`, con una sola fila en `reservas` y el vehículo `RESERVADO`.

## Fuera de alcance

Interfaz, Server Action pública, redirección a WhatsApp (F3-02), listado (F3-03), expiración automática (F3-04), gestión por el personal (Fase 4).

## Criterios de aceptación

- [x] La prueba de concurrencia pasa de forma estable (ejecutarla 20 veces en un bucle y pegar el resultado en las notas).
- [x] Una reserva fallida no deja el vehículo en `RESERVADO` ni filas huérfanas (transacción).
- [x] Sin la variable, `fechaExpiracion` queda a 48 h; con `RESERVA_EXPIRACION_HORAS=24`, a 24 h; con `0`, `null`.
- [x] `pnpm check` y `pnpm build` pasan en local; CI: ver el PR.

## Verificación

`pnpm test` y un script de comprobación manual sobre la BD de desarrollo con filas temporales (ids 9001+) que se limpian al final. Restaurar el estado de los vehículos del seed.

## Recordatorio de proceso

Rama `issue/F3-01-servicio-reservas` + PR; al terminar, estado `REVIEW`. **No fusionar ni marcar `DONE`.** Texto visible en `site-content.ts`; sin afirmaciones comerciales inventadas.

## Notas de entrega

**Qué se hizo** (`src/server/reservations/`, sin interfaz ni Server Action pública):

- `service.ts`: `createReservation({ userId, vehicleId }, deps)` en una única `$transaction`. Orden: (1) `SELECT … FOR UPDATE` sobre la fila del usuario (comprueba `activo` y **serializa las reservas del mismo usuario**, de modo que el tope no se puede burlar con peticiones simultáneas); (2) reserva propia ya activa → `already_reserved_by_you`; (3) tope → `limit_reached`; (4) vehículo existente, `DISPONIBLE` y `visible_catalogo` → si no, `not_available` (cubre vendido, reservado, próximamente y oculto); (5) `updateMany` condicionado a `DISPONIBLE` con `count === 1` (si no, `not_available`); (6) `INSERT` en `PENDIENTE_CONTACTO` con código único (hasta 5 reintentos por colisión; si se agotan lanza y **revierte todo**). Los casos de negocio devuelven `{ status }` y no escriben nada; solo un error inesperado lanza.
- `code.ts`: `RES-AAAA-XXXX` con `crypto.randomInt` y alfabeto `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`.
- `config.ts`: `MAX_ACTIVE_RESERVATIONS_PER_USER = 2` y `DEFAULT_RESERVATION_EXPIRY_HOURS = 48` (únicos lugares, `TODO(owner)`: confirmar antes de producción), `parseReservationExpirationHours` (`RESERVA_EXPIRACION_HORAS`: entero positivo; vacía → 48 h por defecto; `0` → sin expiración, `fechaExpiracion = null`) y `assertReservationEnv`, invocada desde `src/instrumentation.ts`: con un valor inválido el servidor **no arranca** y muestra un mensaje claro (comprobado con `RESERVA_EXPIRACION_HORAS=abc pnpm start`). Documentada en `.env.example` y en el README.
- `events.ts`: líneas JSON `reservation_created` y `reservation_rejected` (con motivo), solo ids; sin nombres, correos ni teléfonos.
- `cache.ts` y `index.ts`: ver la decisión de caché. `index.ts` conecta el servicio con Prisma real, el entorno y la auditoría; la invalidación es un parámetro **obligatorio**.

**Decisión de caché (documentación local de Next 16):** `revalidateTag(tag)` con un argumento está **deprecado** (la firma ahora es `revalidateTag(tag, profile)`), y `updateTag(tag)` solo puede llamarse desde Server Actions pero expira la caché al instante (lectura de lo escrito). Por eso hay dos funciones: `invalidateCatalogFromAction()` (`updateTag`, para la acción de F3-02: quien reserva ve «Reservado» de inmediato) e `invalidateCatalogInBackground()` (`revalidateTag(tag, 'max')`, para F3-04 u otros contextos que no sean Server Actions). Ambas invalidan `catalog-vehicles` y `catalog-filter-options`. El servicio recibe la función como dependencia y solo la llama si la reserva se creó. Se añadió `updateTag` al mock de `next/cache` en `vitest.setup.ts`.

**Tests (33 nuevos; 230 en total):** `code.test.ts`, `config.test.ts` y `service.test.ts` (contra la BD sembrada, con filas temporales de ids 9001+ que cada prueba borra, y solo las suyas porque `catalog/queries.test.ts` comparte la BD). Cubren cada resultado, vehículos vendido/reservado/próximamente/oculto/inexistente, usuario inactivo/inexistente, doble reserva, reserva cancelada que libera cupo, tope (también con 4 reservas simultáneas del mismo usuario → exactamente 2 creadas), colisión de código con reintento y con 5 colisiones (rollback: vehículo sigue `DISPONIBLE`, sin filas huérfanas, sin invalidar caché), `fechaExpiracion` a 24 h, y concurrencia (2 usuarios y 5 usuarios sobre el mismo vehículo → una `created`, el resto `not_available`, una sola fila). Sin BD en local esas pruebas se omiten; **en CI la BD es obligatoria** (si no responde, falla).

**Estabilidad de la prueba de concurrencia:** bucle de 20 iteraciones (cada una ejecutó las pruebas de concurrencia dos veces): 20/20 correctas, y 5 ejecuciones seguidas de la suite completa (230/230). Tras las pruebas: 0 usuarios o vehículos temporales, 0 reservas, y los vehículos del seed intactos.

**Desviaciones y puntos a revisar**

- No hay script manual aparte: la verificación sobre la BD de desarrollo se hizo con las propias pruebas (filas temporales 9001+, limpiadas siempre).
- **Misma persona, doble clic simultáneo:** dos envíos simultáneos del mismo usuario sobre el mismo vehículo quedan serializados por el bloqueo del usuario, así que el segundo recibe `already_reserved_by_you`. Dos usuarios distintos: `not_available`.
- `index.ts` exige `invalidateCache`; F3-02 debe pasar `invalidateCatalogFromAction`.
- El tope de 2 es provisional (`TODO(owner)`).
- Tras la fusión con `main` se adoptó la decisión de #27: 48 h por defecto y `0` desactiva la expiración (la primera entrega no tenía plazo por defecto).

**Cómo verificar**: `pnpm db:seed && pnpm test` (necesita la BD); `RESERVA_EXPIRACION_HORAS=abc pnpm build && pnpm start` debe negarse a arrancar.
