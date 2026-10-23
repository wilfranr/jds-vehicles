# F3-05: Pruebas e2e de reservas y cierre de la Fase 3

- **Estado:** TODO
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

- [ ] Las pruebas e2e nuevas pasan en CI y localmente; el árbol de datos queda limpio.
- [ ] `pnpm check`, `pnpm build` y `pnpm test:e2e` pasan; CI en verde.

## Recordatorio de proceso

Rama `issue/F3-05-e2e-reservas` + PR; al terminar, estado `REVIEW`. **No fusionar ni marcar `DONE`.**

## Observaciones de la revisión de F3-01 a F3-04 (añadidas por el orquestador)

- Verificado a mano: la carrera de dos usuarios sobre el mismo vehículo deja una reserva y un rechazo (7 ms de diferencia); la reserva vence a las 48 h; el enlace de WhatsApp lleva código, vehículo y nombre sin placa ni documento; un código ajeno o malformado da la pantalla de no encontrado; `pnpm reservas:expirar` es idempotente y respeta `EN_NEGOCIACION`.
- En la carrera, el usuario que pierde ve la ficha ya en estado `RESERVADO` (la caché se invalida al instante) y no el mensaje «acaba de ser reservado», porque el formulario se desmonta al cambiar el estado. Es aceptable; el e2e debe comprobar que **ya no hay botón de reservar y se ve el estado reservado**, no el texto del error.
- Con sesión iniciada, el DOM de páginas dinámicas contiene un segundo `<main>`/`<header>` oculto (tamaño 0; ya anotado en F2-06). Usar `getByRole('main')`/`getByRole('banner')`, nunca `locator('main')`.
- Cuando se programe el cron de expiración (Fase 6), la caché de Next no se invalida desde el script: el catálogo tarda hasta 60 s en reflejar una liberación (ver README).
