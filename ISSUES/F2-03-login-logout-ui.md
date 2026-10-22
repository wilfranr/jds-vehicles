# F2-03: Login, cierre de sesión y menú de usuario

- **Estado:** TODO
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

- [ ] Login con el cliente demo funciona y vuelve a la página de origen vía `next`; con credenciales malas muestra el mensaje genérico.
- [ ] `?next=https://evil.com` y `?next=//evil.com` no redirigen fuera del sitio.
- [ ] Cerrar sesión funciona por POST, invalida la sesión y el header vuelve a mostrar "Iniciar sesión".
- [ ] El header refleja la sesión sin errores de hidratación y sin convertir todas las páginas públicas en dinámicas innecesariamente (comprobar el resumen de `pnpm build`).
- [ ] En `/vehiculos/<id>` de un vehículo disponible: sin sesión aparece "Inicia sesión para reservar" y lleva a `/login?next=...`.
- [ ] Accesibilidad: formulario y menú operables por teclado; sin scroll horizontal a 360 px.
- [ ] `pnpm check` y `pnpm build` pasan; CI en verde.

## Verificación

`pnpm dev`: iniciar y cerrar sesión con el cliente demo (`carlos.gomez@example.com`, contraseña del seed), probar `next` hostil, y revisar el header en móvil y escritorio.

## Recordatorio de proceso

Rama `issue/F2-03-login-logout-ui` + PR; al terminar, estado `REVIEW`. **No fusionar ni marcar `DONE`.** Texto visible en `site-content.ts`; sin afirmaciones comerciales inventadas.
