# F2-03: Login, cierre de sesión y menú de usuario

- **Estado:** REVIEW
- **Fase:** 2
- **Depende de:** F2-01, F2-02, **F1-06 fusionado** (F1-06 también modifica `SiteHeader.tsx`; esperar a que esté en `main` para evitar conflictos)
- **Prioridad:** Alta

## Contexto

Con la sesión ya disponible (F2-01) y el registro (F2-02), falta la entrada y salida y que el sitio refleje quién está conectado. En F1-01 se dejó un `TODO(F2)` en el header, y en F1-04 el componente `ReserveCta` quedó preparado para enlazar a `/login?next=...`. **Lee `AGENTS.md` y la documentación local de Next.**

## Alcance

1. Ruta `/login` (grupo `(auth)`): formulario con Server Action, sin JavaScript obligatorio, `noindex`, título "Iniciar sesión | JDS Vehículos".
   - Un único mensaje de error genérico ("Correo o contraseña incorrectos"), el mismo para todos los fallos; los campos conservan el correo (nunca la contraseña).
   - Parámetro `next` validado con `safeNextPath` (de F2-02); si el usuario ya tiene sesión, redirigir a `next`/`/`.
   - Enlace a `/registro` conservando `next`.
   - Texto de "¿Olvidaste tu contraseña?": **no incluirlo** hasta que el propietario decida el proveedor de correo (ver `ISSUES/README.md`).
2. Cierre de sesión mediante Server Action (método POST, nunca un enlace GET), con redirección a `/`.
3. **Header y menú móvil** (`SiteHeader`, `MobileMenu`): resolver el `TODO(F2)`:
   - Sin sesión: botones "Iniciar sesión" y "Crear cuenta".
   - Con sesión: nombre del usuario (primer nombre, truncado) con menú desplegable accesible (teclado, Esc, foco) con "Mi cuenta" (`/mi-cuenta`, F2-05), "Mis reservas" (`/mi-cuenta/reservas`, F2-05) y "Cerrar sesión"; si el rol es `ADMIN` o `ASESOR`, añadir "Panel del concesionario" apuntando a `/admin` (la ruta existirá en la Fase 4: mientras no exista, **no mostrar** el enlace).
   - El layout público debe seguir siendo estático/cacheable donde sea posible: leer la sesión solo en un componente aislado dentro de `<Suspense>` (compatibilidad con Cache Components y PPR; seguir la documentación local). Sin parpadeo de contenido al cargar.
4. **`ReserveCta` (F1-04):** actualizar para vehículos `DISPONIBLE`:
   - Sin sesión: botón principal "Inicia sesión para reservar" → `/login?next=/vehiculos/<id>`.
   - Con sesión: mientras no exista la reserva real (Fase 3), mantener "Consultar disponibilidad por WhatsApp" con `TODO(F3)`. **No** mostrar un botón "Reservar" que no haga nada.
   - Los casos `RESERVADO` y `PROXIMAMENTE` no cambian. Actualizar los tests de `VehicleDetail`.
5. Textos en `site-content.ts`. Iconos con `lucide-react`.
6. **Tests:** formulario de login (render, error genérico), menú de usuario con y sin sesión (componentes con la sesión inyectada), `ReserveCta` con y sin sesión.

7. **Páginas por defecto de Auth.js (revisión de F2-01).** `GET /api/auth/signin` responde hoy con la página genérica de Auth.js, sin la marca del sitio, y los fallos de login redirigen allí (`/api/auth/signin?error=CredentialsSignin`). Configurar `pages: { signIn: '/login', error: '/login' }` en `src/auth.ts` para que los errores vuelvan a `/login?error=...` (mostrando el mensaje genérico `auth.invalidCredentials`) y que no quede una segunda pantalla de inicio de sesión sin marca ni límites de intentos.

8. **Integrar el limitador en la acción de login (pendiente de F2-04).** `src/server/security/limiters.ts` ya está en `main` pero no conectado. En la acción de login, con `ip = getClientIp(await headers())`: `checkLoginAllowed(email, ip)` **antes** de verificar la contraseña (un par bloqueado se rechaza aunque la clave sea correcta; escribir `login_blocked` y mostrar «Demasiados intentos. Inténtalo de nuevo en unos minutos», texto en `site-content.ts`); tras un fallo, `recordLoginFailure` + `login_failed`; tras un éxito, `recordLoginSuccess`. Probar el orden con dependencias inyectadas y con reloj simulado, y añadir a los criterios que el sexto intento fallido del mismo correo+IP sea bloqueado.

## Fuera de alcance

Recuperación de contraseña, "recordarme", páginas `/mi-cuenta` (F2-05), protección de rutas por `proxy.ts` (F2-04).

## Criterios de aceptación

- [x] Login con el cliente demo funciona y vuelve a la página de origen vía `next`; con credenciales malas muestra el mensaje genérico.
- [x] `?next=https://evil.com` y `?next=//evil.com` no redirigen fuera del sitio.
- [x] Cerrar sesión funciona por POST, invalida la sesión y el header vuelve a mostrar "Iniciar sesión".
- [x] El header refleja la sesión sin errores de hidratación y sin convertir todas las páginas públicas en dinámicas innecesariamente (comprobar el resumen de `pnpm build`). _(Las páginas públicas pasan de ○ estático a ◐ prerenderizado parcial: carcasa estática + cuenta en streaming; ninguna es ƒ dinámica.)_
- [x] En `/vehiculos/<id>` de un vehículo disponible: sin sesión aparece "Inicia sesión para reservar" y lleva a `/login?next=...`.
- [x] Accesibilidad: formulario y menú operables por teclado; sin scroll horizontal a 360 px.
- [x] `pnpm check` y `pnpm build` pasan; CI en verde. _(CI pendiente de verse en el PR.)_

## Verificación

`pnpm dev`: iniciar y cerrar sesión con el cliente demo (`carlos.gomez@example.com`, contraseña del seed), probar `next` hostil, y revisar el header en móvil y escritorio.

## Recordatorio de proceso

Rama `issue/F2-03-login-logout-ui` + PR; al terminar, estado `REVIEW`. **No fusionar ni marcar `DONE`.** Texto visible en `site-content.ts`; sin afirmaciones comerciales inventadas.

## Notas de entrega

### Qué se hizo

- **`/login`** (grupo `(auth)`, `noindex`, título «Iniciar sesión | JDS Vehículos»): formulario con Server Action (`useActionState`), funciona sin JavaScript (comprobado). Mensaje único `auth.invalidCredentials`; se conserva el correo, nunca la contraseña. Sin «¿Olvidaste tu contraseña?». Enlace a `/registro` que conserva `next` (con JS; sin JS queda `/registro`).
- **Lógica** `submitLogin(formData, ctx)` (`src/server/auth/submit-login.ts`, inyectable): límite (`checkLoginAllowed`) → verificación → `recordLoginFailure`/`recordLoginSuccess`. Si el par correo+IP está bloqueado se rechaza **aunque la contraseña sea correcta**, con `login_blocked` y `auth.tooManyAttempts`; los fallos escriben `login_failed` con el correo enmascarado. La clave del limitador acota el correo a 150 caracteres.
- **`next`**: se lee del `Referer` y se valida con `safeNextPath` (mismo enfoque que el registro; helper `src/server/auth/referer-next.ts`). **Ya con sesión**, `/login` redirige a `next`/`/` desde `proxy.ts` (se añadió `/login` al `matcher` y `decideAccess` devuelve `redirectAuthenticated`), porque leer la sesión en la página la volvería dinámica.
- **Auth.js `pages`** (punto 7): `signIn` y `error` apuntan a `/login`; `GET /api/auth/signin` ahora redirige a `/login?callbackUrl=…` y los errores vuelven a `/login?error=…` (con JS se muestra el mensaje genérico; sin JS no se puede leer la query en una página estática).
- **Cerrar sesión**: `logoutAction` (`signOut({ redirectTo: '/' })`) invocada desde un `<form action>` (POST), nunca un enlace.
- **Header y menú móvil**: botones «Iniciar sesión» / «Crear cuenta» sin sesión; con sesión, menú de usuario accesible (primer nombre truncado, `aria-expanded`, foco al abrir, flechas, Esc devuelve el foco, clic fuera cierra) con «Mi cuenta», «Mis reservas» y «Cerrar sesión». «Panel del concesionario» está tras `account.showAdminPanelLink = false` (`TODO(F4)`) y no se muestra. `MobileMenu` recibe la sección de cuenta por un slot renderizado en el servidor.
- **Sesión aislada**: se lee solo en `HeaderAccount` / `MobileHeaderAccount` (`<Suspense>` con esqueleto del mismo tamaño y `<noscript>` con enlace a login) y en `ReserveCtaWithSession`; el resto de cada página sigue en la carcasa estática.
- **`ReserveCta` (DISPONIBLE)**: sin sesión, botón principal «Inicia sesión para reservar» → `/login?next=%2Fvehiculos%2F<id>`; con sesión se mantiene «Consultar disponibilidad por WhatsApp» (`TODO(F3)`), sin botón «Reservar». `RESERVADO` y `PROXIMAMENTE` no cambian.
- Textos en `site-content.ts` (`login`, `account`, `vehicleDetail.loginToReserveCta`, `auth.tooManyAttempts`, compartido con F2-07 con la misma línea).
- Tests nuevos (21): `submitLogin` (orden, sexto intento bloqueado aunque la clave sea correcta y desbloqueo con reloj simulado, otro correo no afectado, entradas gigantes), `LoginForm` (campos, error genérico, correo conservado, enlace con `next`), menú de usuario (con/sin sesión, teclado, logout por formulario, panel oculto, truncado), `MobileAccount`, `ReserveCta` con y sin sesión y `decideAccess` para `/login`.

### Hallazgo importante: formularios sin JavaScript y huecos dinámicos

Con Cache Components, un hueco dinámico (`<Suspense>` que lee cookies) en un **layout** hace que la respuesta de un formulario enviado **sin JavaScript** llegue sin la página (solo el fragmento en streaming, oculto). Por eso el layout `(auth)` usa `SiteShell readSession={false}`: el header de `/login` y `/registro` no lee la sesión (siempre muestra los botones de acceso) y esas rutas siguen siendo ○ estáticas. Sin esto se rompían los errores de `/registro` y `/login` sin JS. Consecuencia menor: en `/registro` un usuario con sesión ve «Iniciar sesión / Crear cuenta» en el header.
Relacionado y preexistente: `/vehiculos/[id]` (por su `loading.tsx`) tampoco muestra contenido sin JavaScript, así que ahí el CTA solo existe con JS.

### Verificación (build de producción, `TRUST_PROXY=true AUTH_TRUST_HOST=true`, Playwright)

- CTA sin sesión → `/login?next=%2Fvehiculos%2F1`; credenciales malas → mensaje genérico, correo conservado, contraseña vacía; correctas (`carlos.gomez@example.com`, seed) → vuelve a `/vehiculos/1` (con y sin JS) y el header muestra «Carlos».
- Menú: abre con foco en «Mi cuenta», Esc lo cierra; `/login?next=%2Fcatalogo` con sesión → `/catalogo`; `?next=//evil.com`, `https://evil.com` y `/\evil.com` → `/` (con y sin sesión).
- Cerrar sesión por POST → `/`, header con «Iniciar sesión», `/api/auth/session` = `null`; menú móvil con «Crear cuenta».
- Sin scroll horizontal a 360, 768, 1024, 1280 y 1440 px; cabecera de una sola fila (81 px).
- Seis intentos fallidos con el mismo correo+IP: el sexto muestra «Demasiados intentos…»; `login_failed`/`login_blocked` en el log con `c***@example.com`.
- `GET /api/auth/signin` → 302 a `/login?callbackUrl=…`.

### Notas

- `/mi-cuenta` y `/mi-cuenta/reservas` (F2-05) aún no existen: los enlaces del menú dan 404 hasta entonces.
- Con Next 16 el árbol de la ruta anterior se conserva oculto (`Activity`), por lo que tras una navegación cliente el DOM puede contener dos `<header>` (uno oculto); una recarga deja uno.
- `playwright.config.ts` ahora pasa `AUTH_TRUST_HOST=true` al servidor de e2e: en producción sin esa variable el header público registra `UntrustedHost` en cada petición (la página se sirve como anónima). Está en el checklist de despliegue del README.
- `registro/actions.ts` mantiene su propia `nextFromReferer` (F2-07 la modifica); conviene unificarla con `referer-next.ts` después de fusionar ambos PR.
