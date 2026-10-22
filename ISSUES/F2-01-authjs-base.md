# F2-01: Auth.js: configuración base, sesiones y helpers de servidor

- **Estado:** TODO
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

- [ ] `pnpm check` y `pnpm build` pasan; CI en verde.
- [ ] Con el seed demo, `verifyCredentials('admin@jdsvehiculos.com', <contraseña del seed>)` devuelve el usuario con rol `ADMIN`, y credenciales inválidas devuelven `null` con el mismo mensaje.
- [ ] `POST /api/auth/callback/credentials` (o la ruta equivalente de la versión instalada) crea una sesión y `GET /api/auth/session` la devuelve **sin** campos sensibles.
- [ ] Sin `AUTH_SECRET` en producción el servidor se niega a arrancar con un mensaje claro.
- [ ] Las cookies de sesión llevan `HttpOnly` y `SameSite=Lax` (y `Secure` en producción); anotar en las notas cómo se comprobó.
- [ ] Ninguna pantalla ni respuesta distingue "correo inexistente" de "contraseña incorrecta".

## Verificación

```bash
pnpm check && pnpm build
pnpm db:seed && pnpm dev
curl -s -c /tmp/jar -X POST localhost:3000/api/auth/callback/credentials ...   # documentar el comando real
curl -s -b /tmp/jar localhost:3000/api/auth/session
```

## Recordatorio de proceso

Rama `issue/F2-01-authjs-base` + PR; al terminar, estado `REVIEW`. **No fusionar ni marcar `DONE`.** Todo texto visible al usuario va en `src/lib/site-content.ts` y no se inventan afirmaciones comerciales (ver reglas de contenido en `ISSUES/README.md`).
