# F3-05: Pruebas e2e de reservas y cierre de la Fase 3

- **Estado:** REVIEW
- **Fase:** 3
- **Depende de:** F3-02, F3-03, F3-04
- **Prioridad:** Alta

## Contexto

Cierra la Fase 3 con pruebas de punta a punta en Playwright (job E2E de CI, con BD MySQL y seed) y una revisión de seguridad del flujo. Seguir el patrón de `e2e/` de F1-06/F2-06 (usuarios temporales con dominio `@e2e-test.local`, limpieza garantizada). **Lee `AGENTS.md`.**

## Alcance

1. Flujo completo: iniciar sesión → abrir un vehículo `DISPONIBLE` → "Reservar este vehículo" → llega a la confirmación con código → el enlace de WhatsApp tiene el formato correcto (verificar el `href`, no abrir WhatsApp) → el catálogo y la ficha muestran el vehículo `RESERVADO` → aparece en "Mis reservas".
2. Sin sesión: el botón lleva a `/login?next=...` y, tras iniciar sesión, vuelve a la ficha.
3. **Concurrencia:** dos contextos de navegador (dos usuarios) reservando el mismo vehículo simultáneamente: exactamente una reserva creada, el otro ve el mensaje de "ya reservado".
4. Aislamiento: el usuario B no puede abrir `/mi-cuenta/reservas/<codigo de A>` (404).
5. Tope de reservas activas por usuario (F3-01) y límite de intentos de reserva.
6. Cada prueba deja los vehículos del seed como estaban (restaurar `disponibilidad` y borrar las reservas creadas) incluso si falla.
7. `README`: sección "Reservas" (flujo, variable `RESERVA_EXPIRACION_HORAS`, cron de expiración, qué invalida la caché).
8. Actualizar `ISSUES/README.md` con la Fase 3 y dejar anotadas las decisiones por confirmar antes de producción (plazo de 48 h, tope de 2 reservas activas, el cliente no cancela).

## Criterios de aceptación

- [x] Las pruebas e2e nuevas pasan localmente (CI: ver el PR); el árbol de datos queda limpio.
- [x] `pnpm check`, `pnpm build` y `pnpm test:e2e` pasan; CI en verde.

## Recordatorio de proceso

Rama `issue/F3-05-e2e-reservas` + PR; al terminar, estado `REVIEW`. **No fusionar ni marcar `DONE`.**

## Observaciones de la revisión de F3-01 a F3-04 (añadidas por el orquestador)

- Verificado a mano: la carrera de dos usuarios sobre el mismo vehículo deja una reserva y un rechazo (7 ms de diferencia); la reserva vence a las 48 h; el enlace de WhatsApp lleva código, vehículo y nombre sin placa ni documento; un código ajeno o malformado da la pantalla de no encontrado; `pnpm reservas:expirar` es idempotente y respeta `EN_NEGOCIACION`.
- En la carrera, el usuario que pierde ve la ficha ya en estado `RESERVADO` (la caché se invalida al instante) y no el mensaje «acaba de ser reservado», porque el formulario se desmonta al cambiar el estado. Es aceptable; el e2e debe comprobar que **ya no hay botón de reservar y se ve el estado reservado**, no el texto del error.
- Con sesión iniciada, el DOM de páginas dinámicas contiene un segundo `<main>`/`<header>` oculto (tamaño 0; ya anotado en F2-06). Usar `getByRole('main')`/`getByRole('banner')`, nunca `locator('main')`.
- Cuando se programe el cron de expiración (Fase 6), la caché de Next no se invalida desde el script: el catálogo tarda hasta 60 s en reflejar una liberación (ver README).

## Notas de entrega

**Qué se hizo** (`e2e/reservas.spec.ts`, 7 pruebas; con las existentes, 21 en total):

1. **Flujo completo:** iniciar sesión → ficha → «Reservar este vehículo» → confirmación (`?nueva=1`, título y código) → el `href` de WhatsApp (`https://wa.me/<número>?text=…`, no se abre) contiene código, `Toyota Corolla` y el nombre, sin la placa → fila `PENDIENTE_CONTACTO` con expiración a 48 h → el catálogo filtrado por color muestra `RESERVADO` → la ficha ya no tiene botón y muestra el estado reservado → aparece en «Mis reservas» con su estado.
2. **Sin sesión:** el botón lleva a `/login?next=%2Fvehiculos%2F<id>`; tras iniciar sesión vuelve a la ficha con el botón visible y **no se creó ninguna reserva**.
3. **Concurrencia:** dos contextos (dos usuarios) pulsan a la vez; exactamente uno llega a la confirmación y una sola fila. El perdedor se comprueba como pide la revisión: **ya no hay botón de reservar y se ve el estado reservado** (no el texto de error).
4. **Aislamiento:** el dueño abre su reserva; otro usuario ve «Página no encontrada», el código no aparece y su lista está vacía. Aparte, códigos mal formados (`RES-1-X`, `..%2F`, `%3Cscript%3E`) responden 404 real.
5. **Tope de reservas activas:** con 2 activas, la tercera muestra el mensaje con el enlace a «Ver mis reservas»; el vehículo sigue `DISPONIBLE` y no se crea fila.
6. **Límite de intentos de reserva:** 10 intentos (rechazados por el tope) y el undécimo muestra «Demasiados intentos».

Se usan `getByRole('main')` / `getByRole('banner')` y nunca `locator('main')`.

**Datos temporales y limpieza (punto 6 del issue):** cada prueba crea **sus propios vehículos** (color `E2E-RESERVAS-<hex>`, con foto, `USADO` con placa para comprobar que no se filtra) y usuarios `@e2e-test.local`, por lo que **no se modifican los vehículos del seed** (no hay nada que restaurar) y las pruebas no compiten entre sí en paralelo. `afterEach` borra reservas, vehículos y usuarios de la prueba aunque falle. Además `e2e/global-setup.ts` barre restos de una ejecución interrumpida al empezar y al terminar, y falla si cambian los conteos de usuarios, vehículos o reservas (comprobado: con filas residuales insertadas a mano, la siguiente ejecución las eliminó). Marcas en `e2e/test-data.ts`. Estado final de la BD de desarrollo: 2 usuarios, 3 vehículos del seed intactos (1 y 2 `DISPONIBLE`, 3 `PROXIMAMENTE`), 0 reservas.

**Otros cambios**

- `package.json`: alias `test:e2e` (el issue y el orquestador lo nombran así; el script existente `e2e` se conserva).
- README: sección «Reservas» (flujo, límites, `RESERVA_EXPIRACION_HORAS`, cron, qué invalida la caché, pruebas); `pnpm test:e2e` documentado.
- `ISSUES/README.md`: ya recogía la Fase 3 y las decisiones por confirmar antes de producción (48 h, tope de 2, el cliente no cancela) tras #27/#36; no hizo falta cambiarlo.

**Verificado:** `pnpm check` (294 pruebas) y `pnpm build` en verde; `pnpm test:e2e` 21 pasan y 1 `fixme` (variantes de `/admin`, Fase 4), repetido 3 veces seguidas sin fallos.

**Para revisar:** la prueba de límite de intentos usa el estado «tope alcanzado» para agotar los 10 intentos con rapidez; el contador es en memoria por usuario y los usuarios son nuevos en cada ejecución, así que no se arrastra entre corridas. Sigue en los logs del servidor el aviso `crypto.getRandomValues()` ya reportado en F2-06 (no afecta a las pruebas).

**Cómo verificar**: `pnpm db:seed && pnpm build && pnpm test:e2e` y `SELECT COUNT(*) FROM usuarios, vehiculos, reservas` sin cambios.
