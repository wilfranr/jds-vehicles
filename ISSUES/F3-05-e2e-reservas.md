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
8. Actualizar `ISSUES/README.md` con la Fase 3 y dejar anotadas las decisiones pendientes del propietario (plazo de expiración, tope de reservas, y si el cliente debe poder cancelar).

## Criterios de aceptación

- [ ] Las pruebas e2e nuevas pasan en CI y localmente; el árbol de datos queda limpio.
- [ ] `pnpm check`, `pnpm build` y `pnpm test:e2e` pasan; CI en verde.

## Recordatorio de proceso

Rama `issue/F3-05-e2e-reservas` + PR; al terminar, estado `REVIEW`. **No fusionar ni marcar `DONE`.**
