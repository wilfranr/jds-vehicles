# F3-03: Mis reservas y confirmación

- **Estado:** TODO
- **Fase:** 3
- **Depende de:** F3-01 (puede desarrollarse en paralelo con F3-02; la confirmación de F3-02 usa esta página)
- **Prioridad:** Alta

## Contexto

`/mi-cuenta/reservas` hoy muestra el estado vacío (F2-05). Debe mostrar las reservas reales del usuario y la página de confirmación a la que lleva F3-02. **Lee `AGENTS.md` y la documentación local de Next.**

## Alcance

1. **Consultas** en `src/server/reservations/queries.ts` (solo lectura): reservas del usuario de la sesión (ordenadas por fecha, más recientes primero) y una reserva por código. **Autorización por propiedad**: la consulta por código filtra por `usuarioId` de la sesión; un código ajeno responde `notFound()` (404, sin revelar que existe).
2. `/mi-cuenta/reservas`: lista de tarjetas con foto principal, marca/modelo/año, código, fecha, estado con chip de color (`PENDIENTE_CONTACTO` "Pendiente de contacto", `EN_NEGOCIACION` "En negociación", `COMPLETADA`, `CANCELADA`, `EXPIRADA`; textos en `site-content.ts`), y enlace al detalle. Mantener el estado vacío amable. Paginación simple si hay más de 20.
3. `/mi-cuenta/reservas/[codigo]`: detalle con los datos del vehículo (sin placa completa; misma regla del resto del sitio), estado, fechas y, si la reserva está activa (`PENDIENTE_CONTACTO` o `EN_NEGOCIACION`), el botón verde "Abrir conversación en WhatsApp" que reconstruye el enlace con la función de F3-02 (no confiar en un enlace guardado antiguo: el número del concesionario puede haber cambiado). Con `?nueva=1`, bloque de confirmación destacado ("Tu reserva quedó registrada. Continúa por WhatsApp con tu asesor") que recuerda el código. Si la reserva tiene `fechaExpiracion`, mostrarla; si no, no mencionar plazos.
4. Validar el parámetro `[codigo]` con una expresión estricta (`/^RES-\d{4}-[A-Z2-9]{4}$/`) antes de consultar; cualquier otra cosa → `notFound()`. Todas las páginas con `noindex`, `requireUser()` además del proxy.
5. Textos en `site-content.ts`; sin afirmaciones sobre plazos, garantías o pasos que no estén en `docs/` (el cierre del negocio ocurre fuera de la plataforma, como dice §1.4: no describirlo en detalle).
6. **Tests:** consultas con la BD de pruebas (un usuario no ve ni abre reservas ajenas), validación del código, render de la lista (vacía y con datos) y del chip de estado.

## Fuera de alcance

Cancelar o editar la reserva desde el cliente, notificaciones por correo, gestión por el personal (Fase 4).

## Criterios de aceptación

- [ ] Un usuario solo ve sus reservas; abrir el código de otro usuario da 404 (probar con dos cuentas).
- [ ] Tras reservar (F3-02) la página de confirmación muestra el código y el botón de WhatsApp funcional.
- [ ] Códigos malformados (`RES-1-X`, `../`, `<script>`) dan 404 sin error de servidor.
- [ ] Sin scroll horizontal a 360 px; accesible por teclado; chips con contraste suficiente.
- [ ] `pnpm check` y `pnpm build` pasan; CI en verde.

## Verificación

Con filas temporales en la BD de desarrollo (limpiar al terminar) y dos usuarios; revisar a 360 y 1280 px.

## Recordatorio de proceso

Rama `issue/F3-03-mis-reservas` + PR; al terminar, estado `REVIEW`. **No fusionar ni marcar `DONE`.**
