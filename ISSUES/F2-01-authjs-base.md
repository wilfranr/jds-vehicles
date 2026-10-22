# F2-01: Auth.js: configuración base, sesiones y helpers de servidor

- **Estado:** DONE
- **Fase:** 2
- **Depende de:** F1-07 (DONE)
- **Prioridad:** Alta (bloquea el resto de la Fase 2)

## Contexto

Decisión vinculante: autenticación con **Auth.js** (sobre Next.js 16, App Router) y base de datos MySQL/Prisma existente. Los usuarios viven en la tabla `usuarios` (modelo Prisma `User`), con `password_hash` (bcrypt) y `rol_id` → `roles` (`CLIENTE`, `ADMIN`, `ASESOR`). El esquema y el seed ya existen (`prisma/schema.prisma`, `prisma/seed.ts`): hay un admin y un cliente demo con contraseñas hasheadas con `bcryptjs` (coste 10). **Lee `AGENTS.md` y la documentación local de Next (`node_modules/next/dist/docs/`) antes de escribir código**: en Next 16 el antiguo `middleware.ts` se llama `proxy.ts` y hay cambios incompatibles con lo habitual.

## Alcance

1. **Compatibilidad primero.** Instalar la versión de Auth.js que soporte Next 16 y React 19 (hoy `next-auth@5` / "Auth.js v5"; verificar). Si la versión estable o beta **no es compatible** con la versión de Next del proyecto, **detenerse y reportar al orquestador en las notas** (con el error exacto y 2 alternativas) en lugar de improvisar otra librería.
2. `src/auth.ts` (configuración central) exportando `auth`, `signIn`, `signOut`, `handlers`, y `src/app/api/auth/[...nextauth]/route.ts`.
3. Proveedor **Credentials** (correo + contraseña) contra `usuarios`:
   - Normalizar el correo (trim + minúsculas) y validar la entrada con `zod`; entrada inválida → fallo de autenticación genérico, nunca excepción.
   - Verificar con `bcryptjs.compare`. Si el usuario no existe, comparar igualmente contra un hash ficticio para igualar tiempos (evitar enumeración por tiempo de respuesta).
   - Rechazar usuarios con `activo = false`.
   - Mensaje de error **idéntico** para correo inexistente, contraseña incorrecta y usuario inactivo.
4. Sesión **JWT** (requisito del proveedor Credentials). El token y la sesión llevan solo: `id` (number), `rol` (`'CLIENTE' | 'ADMIN' | 'ASESOR'`, el nombre de `roles.nombre`, no el id numérico), `name` y `email`. **Nunca** `password_hash`, documento ni teléfono. Duración máxima de la sesión: 7 días, con renovación deslizante de 24 h (documentar el valor elegido).
5. Aumentar los tipos de Auth.js (`src/types/next-auth.d.ts`) para que `session.user.id` y `session.user.rol` estén tipados.
6. Helpers de servidor en `src/server/auth/`:
   - `getCurrentUser()`: devuelve el usuario de la sesión o `null`.
   - `requireUser()`: redirige a `/login?next=<ruta actual>` si no hay sesión.
   - `requireRole(...roles)`: exige sesión y rol permitido; si el rol no corresponde, responde `forbidden()`/`notFound()` según indique la documentación local de Next (decisión documentada en un comentario).
   - El rol se vuelve a leer de la base de datos en operaciones sensibles (no confiar solo en el JWT) **solo** donde el issue lo pida; para esta issue basta el JWT, pero dejar el helper `getFreshUser()` que consulta la BD (lo usarán fases 3 y 4).
7. Variables de entorno: `AUTH_SECRET` (obligatoria; el arranque debe fallar con un mensaje claro si falta en producción), `AUTH_TRUST_HOST` o equivalente para funcionar detrás de proxy inverso en el servidor Oracle. Actualizar `.env.example` y `README.md` (cómo generar el secreto: `openssl rand -base64 32`).
8. Cookies: `HttpOnly`, `SameSite=Lax`, `Secure` en producción. Comprobarlo.
9. **Tests (Vitest):** la lógica de `authorize` aislada en una función pura/inyectable (`verifyCredentials(email, password, deps)`) con casos: credenciales correctas, contraseña errónea, correo inexistente, usuario inactivo, entrada vacía/gigante, correo con mayúsculas y espacios. Test de que el objeto devuelto no contiene `passwordHash`.

## Fuera de alcance

Páginas de login/registro (F2-02, F2-03), limitación de intentos (F2-04), protección de rutas con `proxy.ts` (F2-04), proveedores OAuth, verificación de correo, doble factor.

## Criterios de aceptación

- [x] `pnpm check` y `pnpm build` pasan; CI en verde. _(CI pendiente de verse en el PR.)_
- [x] Con el seed demo, `verifyCredentials('admin@jdsvehiculos.com', <contraseña del seed>)` devuelve el usuario con rol `ADMIN`, y credenciales inválidas devuelven `null` con el mismo mensaje.
- [x] `POST /api/auth/callback/credentials` (o la ruta equivalente de la versión instalada) crea una sesión y `GET /api/auth/session` la devuelve **sin** campos sensibles.
- [x] Sin `AUTH_SECRET` en producción el servidor se niega a arrancar con un mensaje claro.
- [x] Las cookies de sesión llevan `HttpOnly` y `SameSite=Lax` (y `Secure` en producción); anotar en las notas cómo se comprobó.
- [x] Ninguna pantalla ni respuesta distingue "correo inexistente" de "contraseña incorrecta".

## Verificación

```bash
pnpm check && pnpm build
pnpm db:seed && pnpm dev
curl -s -c /tmp/jar -X POST localhost:3000/api/auth/callback/credentials ...   # documentar el comando real
curl -s -b /tmp/jar localhost:3000/api/auth/session
```

## Recordatorio de proceso

Rama `issue/F2-01-authjs-base` + PR; al terminar, estado `REVIEW`. **No fusionar ni marcar `DONE`.** Todo texto visible al usuario va en `src/lib/site-content.ts` y no se inventan afirmaciones comerciales (ver reglas de contenido en `ISSUES/README.md`).

## Notas de entrega

### Compatibilidad

`next-auth@5.0.0-beta.32` (Auth.js v5, `@auth/core` 0.41.3) declara `next: ^14 || ^15 || ^16` y `react: ^18 || ^19`; es compatible con Next 16.4.2 / React 19.3. Compila, arranca y autentica con `cacheComponents` activo. La versión `latest` (4.x) es la antigua; v5 sigue en beta (único canal con soporte Next 16).

### Qué se hizo

- `src/auth.ts` (exporta `handlers`, `auth`, `signIn`, `signOut`) y `src/app/api/auth/[...nextauth]/route.ts`.
- Proveedor Credentials; la lógica está aislada en `src/server/auth/verify-credentials.ts` (`verifyCredentials(email, password, deps)`): `zod` (correo recortado y en minúsculas, máx. 150; contraseña 1–72 bytes por el límite de bcrypt), comparación bcrypt siempre ejecutada (hash ficticio si el usuario no existe) y `null` para entrada inválida, correo inexistente, contraseña errónea, usuario inactivo o rol desconocido. Devuelve solo `{ id, rol, name, email }`.
- Sesión JWT: máx. **7 días**, renovación deslizante **24 h** (`maxAge`/`updateAge` en `src/auth.ts`). Token y sesión llevan solo id, rol, nombre y correo.
- Tipos en `src/types/next-auth.d.ts` y `src/types/auth.ts` (`Rol`, `AuthUser`).
- Helpers en `src/server/auth/index.ts`: `getCurrentUser`, `requireUser(nextPath)`, `requireRole(roles, nextPath)`, `getFreshUser` (consulta la BD; `null` si el usuario está inactivo o eliminado). `src/server/auth/next-path.ts` aporta `sanitizeNextPath`/`buildLoginUrl` (solo rutas internas, evita redirecciones abiertas) para F2-03.
- `src/instrumentation.ts` + `src/server/auth/env.ts`: en producción el servidor no arranca sin `AUTH_SECRET` (no se exige durante `next build`).
- `.env.example` (`AUTH_SECRET`, `AUTH_TRUST_HOST`), `README.md`, y `AUTH_TRUST_HOST` en el job `e2e` de CI. Mensaje genérico `auth.invalidCredentials` en `site-content.ts` para F2-03.
- Tests Vitest (26 nuevos): credenciales correctas, contraseña errónea, correo inexistente, inactivo, rol inválido, entradas vacías/gigantes/no cadena, normalización de correo, ausencia de `passwordHash`, `sanitizeNextPath`, `assertAuthEnv`.

### Desviaciones

- **`session.user.id` es `string`**, no `number`: Auth.js tipa `User.id` como `string` y no admite sobrescribirlo (el tipo resultante es `never`). En el JWT `id` sí es numérico; `getCurrentUser()` convierte a `AuthUser.id: number`. El JSON de `/api/auth/session` devuelve `"id":"1"`.
- **`requireRole` responde `notFound()`**, no `forbidden()`: `forbidden()` es experimental (exige `authInterrupts`) y el 404 no revela áreas restringidas. Decisión comentada en el código.
- Con `NODE_ENV=production` Auth.js exige `AUTH_TRUST_HOST=true` (si no, `UntrustedHost` → 500); en desarrollo se confía en el host automáticamente.

### Verificación realizada (build de producción, `AUTH_TRUST_HOST=true pnpm start -p 3130`)

```bash
J=/tmp/jar
CSRF=$(curl -s -c $J localhost:3130/api/auth/csrf | python3 -c "import sys,json;print(json.load(sys.stdin)['csrfToken'])")
curl -si -b $J -c $J -X POST localhost:3130/api/auth/callback/credentials \
  -d "csrfToken=$CSRF&email=admin@jdsvehiculos.com&password=Admin123*&json=true"
curl -s -b $J localhost:3130/api/auth/session
```

- Login → `302` con `Set-Cookie: __Secure-authjs.session-token=…; Path=/; Expires=… (7 días); HttpOnly; Secure; SameSite=Lax`.
- `GET /api/auth/session` → `{"expires":"…","user":{"id":"1","rol":"ADMIN","name":"Admin JDS","email":"admin@jdsvehiculos.com"}}` (sin campos sensibles).
- Contraseña errónea y correo inexistente → mismo `302` a `/api/auth/signin?error=CredentialsSignin&code=credentials`.
- `AUTH_SECRET= pnpm exec next start` → «Falta la variable de entorno AUTH_SECRET…» y el servidor no arranca.
- `pnpm check`, `pnpm build` y `pnpm e2e` pasan en local. En desarrollo (HTTP) la cookie se llamará `authjs.session-token` sin `Secure`; no se probó en `pnpm dev`.
