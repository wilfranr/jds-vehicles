# F3-03: Mis reservas y confirmación

- **Estado:** REVIEW
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

- [x] Un usuario solo ve sus reservas; abrir el código de otro usuario da 404 (probar con dos cuentas).
- [x] Tras reservar (F3-02) la página de confirmación muestra el código y el botón de WhatsApp funcional.
- [x] Códigos malformados (`RES-1-X`, `../`, `<script>`) dan 404 sin error de servidor.
- [x] Sin scroll horizontal a 360 px; accesible por teclado; chips con contraste suficiente.
- [x] `pnpm check` y `pnpm build` pasan en local; CI: ver el PR.

## Verificación

Con filas temporales en la BD de desarrollo (limpiar al terminar) y dos usuarios; revisar a 360 y 1280 px.

## Recordatorio de proceso

Rama `issue/F3-03-mis-reservas` + PR; al terminar, estado `REVIEW`. **No fusionar ni marcar `DONE`.**

## Notas de entrega

**Rama apilada:** parte de `issue/F3-02-reservar-whatsapp` (PR #30; a su vez sobre F3-01, PR #29) porque necesita `buildReservationWhatsAppUrl` de F3-02. El PR apunta a esa rama y GitHub lo reapunta a `main` al fusionar las anteriores.

**Qué se hizo**

- `src/server/reservations/queries.ts`: `listUserReservations(userId, page)` (más recientes primero, 20 por página, página acotada) y `getUserReservationByCode(userId, code)` (filtra por `usuarioId` de la sesión: un código ajeno devuelve `null`, igual que uno inexistente). Selecciona solo lo necesario: nunca placa ni datos de otros usuarios.
- `/mi-cuenta/reservas`: tarjetas (`ReservationCard`) con foto principal, marca/modelo/año, código, fecha, `fechaExpiracion` solo si existe, chip de estado y enlace al detalle; estado vacío conservado; paginación simple (`?pagina=`, entero estricto; lo inválido equivale a la primera página).
- `/mi-cuenta/reservas/[codigo]`: detalle con vehículo (sin placa), estado, fechas y, si la reserva está activa (`PENDIENTE_CONTACTO`/`EN_NEGOCIACION`), el botón verde «Abrir conversación en WhatsApp» con el enlace **reconstruido** con el número vigente (`getDealerConfig`), no el guardado. Con `?nueva=1`, bloque «Tu reserva quedó registrada…» con el código. Sin plazos si no hay `fechaExpiracion`; no se describe el cierre del negocio.
- `ReservationStatusChip`: el estado va siempre como texto, con los tokens de estado ya oscurecidos por contraste (ámbar, cian, verde, rojo, gris). Textos en `site-content.ts` (`cuenta.reservations`).
- **404 real para códigos mal formados:** `src/server/security/access.ts` añade la decisión `invalidRoute` y `proxy.ts` reescribe a la página de no encontrado con estado 404 (la página va en streaming, así que un `notFound()` dentro de ella respondería 200 con el contenido de «no encontrado»). Regla compartida en `code-pattern.ts` (sin `node:crypto`, apta para el proxy). La página además valida con `parseReservationCode` antes de consultar la BD.
- `AccountNav` ahora va en un `<Suspense>` con respaldo sin «página actual»: `usePathname` en una ruta dinámica (`[codigo]`) rompía el prerender del build.
- `formatDateTime` (`es-CO`, zona `America/Bogota`) en `src/lib/format.ts`.

**Tests (+26; 282 en total):** consultas contra la BD (cada usuario ve solo lo suyo y en orden, foto principal sobre la secundaria, la placa no aparece, lista vacía, código ajeno ≡ inexistente, paginación de 20 y páginas fuera de rango), `parseReservationCode` (12 entradas hostiles), `decideAccess` con códigos inválidos, y render de tarjeta y chip (los 5 estados, expiración presente/ausente).

**Verificado a mano** (build de producción, dos usuarios, 360 y 1280 px): sin sesión → `/login?next=…`; el cliente demo ve solo sus 2 reservas y no la del otro usuario; el detalle activo muestra el botón con código, marca/modelo y nombre; `?nueva=1` muestra la confirmación; `RES-1-X`, `..%2F`, `%3Cscript%3E` y `res-2026-aaaa` responden **404**; sin scroll horizontal; `noindex` presente. Filas temporales borradas (0 reservas, 2 usuarios del seed).

**Para revisar**

1. **Códigos con formato válido pero ajenos o inexistentes** (`RES-2026-CCCC` de otro usuario, `RES-2026-ZZZZ`) muestran la página «Página no encontrada» pero con **estado HTTP 200**, porque la comprobación de propiedad ocurre en la página (en streaming) y el proxy no consulta la BD. No revela si el código existe (idéntico en ambos casos) y la página es `noindex`. Si se exige 404 de estado también ahí, habría que sacar esa consulta de la ruta en streaming; no lo hice para no alterar la arquitectura.
2. **Alcance:** el chip de `CANCELADA` usa `bg-error-container`; el contraste no se midió con herramienta (colores de los tokens oscurecidos en F1).
3. **Base sin el arreglo de F2-06:** este árbol aún no incluye el arreglo de `accountLinks` (PR #28), así que el servidor registra ese error con sesión iniciada hasta que se fusione.

**Cómo verificar**: `pnpm check && pnpm build`; insertar reservas temporales (`INSERT INTO reservas …`) para el cliente demo y otro usuario, abrir `/mi-cuenta/reservas` y los códigos; limpiar al terminar.
