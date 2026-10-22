# F2-04: Protección de rutas y limitación de intentos

- **Estado:** DONE
- **Fase:** 2
- **Depende de:** F2-01
- **Prioridad:** Alta (puede hacerse en paralelo con F2-02)

## Contexto

Tras F2-01 hay sesiones y helpers, pero nada impide que se fuerce una contraseña por fuerza bruta ni que se entre a rutas privadas escribiendo la URL. El sitio correrá en un único servidor (Oracle) detrás de un proxy inverso. **Lee `AGENTS.md` y la documentación local de Next:** en Next 16 el archivo de intercepción de peticiones es `proxy.ts` (antes `middleware.ts`); sigue lo que documente la versión instalada.

## Alcance

1. **Protección de rutas (defensa en profundidad):**
   - `src/proxy.ts` (o el nombre/convención que indique la documentación local) que redirige a `/login?next=<ruta>` cuando se accede sin sesión a `/mi-cuenta/**`, y que bloquea `/admin/**` salvo `ADMIN`/`ASESOR`. Debe ser **liviano**: solo lee el JWT, sin consultar la BD, y no se ejecuta sobre archivos estáticos ni `/api/auth/**`.
   - **El proxy no es la única barrera:** cada página/acción privada debe volver a comprobar con `requireUser()` / `requireRole()` (F2-01). Documentarlo en un comentario y cubrirlo con un test que llame a la acción sin sesión.
   - Un usuario `CLIENTE` que intenta entrar a `/admin` recibe 404 (no revelar la existencia de la ruta) o 403 según la decisión documentada en F2-01.
2. **Limitación de intentos** (`src/server/security/rate-limit.ts`): módulo con una interfaz simple (`check(key): { allowed: boolean; retryAfterSeconds: number }`) y una implementación **en memoria** (ventana deslizante con limpieza periódica y tope de entradas para no crecer sin límite). Documentar que, al ser en memoria, solo es válida con un único proceso (es el caso del servidor previsto) y cómo sustituirla por una implementación con la base de datos si se escala.
   - Login: máximo 5 intentos fallidos por **combinación** correo+IP y 20 por IP en 15 minutos; al excederlo, respuesta genérica "Demasiados intentos. Inténtalo de nuevo en unos minutos" (sin indicar si el correo existe) y cabecera/valor `retryAfter`. Un login correcto no reinicia el contador de la IP, solo el del par correo+IP.
   - Registro: máximo 5 registros por IP por hora.
   - La IP se obtiene de forma segura detrás de proxy inverso: usar `x-forwarded-for` **solo** si se activa por variable de entorno (`TRUST_PROXY=true`, documentada en `.env.example`) y tomar el valor que corresponda según la cantidad de proxies confiables (`TRUST_PROXY_HOPS`); si no, usar la IP del socket o un valor fijo. Nunca confiar ciegamente en el primer valor de `x-forwarded-for`.
   - Integrar el limitador en la acción de login (F2-01/F2-03) y en la de registro (F2-02). Como estas issues pueden estar todavía en revisión, exponer el módulo y sus pruebas aquí, y la integración se hace en el PR que primero encuentre ambos puntos de entrada en `main` (anotarlo en las notas de entrega para que el orquestador cree el seguimiento si falta alguno).
3. **Registro de eventos de seguridad** (`src/server/security/audit.ts`): función `logSecurityEvent({ type, userId?, ip, detail? })` que escribe a `console` en formato JSON de una línea (`login_failed`, `login_blocked`, `register_blocked`, `forbidden_access`) **sin** datos sensibles (ni contraseñas ni hashes ni el correo completo: enmascarar `a***@dominio.com`).
4. **Cabeceras adicionales:** si F1-06 aún no definió las cabeceras de seguridad básicas en `next.config.ts`, añadirlas aquí (`X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`/`frame-ancestors`, `Permissions-Policy`); si ya existen, no duplicar. Sin una CSP estricta (se decide en la Fase 5).
5. **Tests:** el limitador (ventanas, bloqueo, desbloqueo, límite de entradas, claves distintas independientes), la extracción de IP con y sin `TRUST_PROXY`, el enmascarado de correo, y las reglas del proxy como función pura (`decideAccess(pathname, session) → allow | redirectLogin | notFound`).

6. **Sesiones JWT y usuarios desactivados (revisión de F2-01).** El JWT dura hasta 7 días y no se revoca: si se desactiva a un usuario o se le cambia el rol, su token sigue siendo válido hasta que expire. Por eso el proxy solo puede usarse como primera barrera, y toda acción sensible (cambio de contraseña, reservas en la Fase 3, panel en la Fase 4) debe usar `getFreshUser()` de `src/server/auth/index.ts`, que consulta la BD. Documentar esta regla en un comentario en `proxy.ts` y añadir un test de que `decideAccess` no concede acceso por un rol obsoleto cuando se le pasa un rol fresco distinto.
7. **Despliegue:** en producción Auth.js exige `AUTH_TRUST_HOST=true` detrás del proxy inverso (sin él responde 500 `UntrustedHost`). Añadirlo al checklist de despliegue en `README.md` junto con `AUTH_SECRET`; se usará en la Fase 6.

## Fuera de alcance

CAPTCHA, bloqueo permanente de cuentas, Redis, WAF, doble factor.

## Criterios de aceptación

- [x] Sin sesión, `/mi-cuenta` redirige a `/login?next=%2Fmi-cuenta` (con `curl -i` se ve el 307/302).
- [x] Con sesión de `CLIENTE`, `/admin` no es accesible; con `ADMIN` sí podrá serlo cuando exista (comprobado por el test de `decideAccess`).
- [x] Tras 5 intentos fallidos de login con el mismo par correo+IP, el sexto es bloqueado aunque se use la contraseña correcta, y se desbloquea al pasar la ventana (test con reloj simulado).
- [x] El limitador no crece sin límite (test con 100 000 claves distintas).
- [x] Los registros de seguridad no contienen contraseñas ni correos completos.
- [x] El proxy no se ejecuta en `/_next/**`, imágenes ni `/api/auth/**` (comprobar el `matcher`).
- [x] `pnpm check` y `pnpm build` pasan; CI en verde. _(CI pendiente de verse en el PR.)_

## Verificación

```bash
pnpm check && pnpm build && pnpm start &
curl -si localhost:3000/mi-cuenta | head -5
for i in 1 2 3 4 5 6; do curl -s -o /dev/null -w "%{http_code}\n" -X POST ... ; done   # documentar el comando real
```

## Recordatorio de proceso

Rama `issue/F2-04-seguridad-rutas-limites` + PR; al terminar, estado `REVIEW`. **No fusionar ni marcar `DONE`.**

## Notas de entrega

### Qué se hizo

- **`src/proxy.ts`** (convención de Next 16): decodifica el JWT con `getToken` (sin BD) y aplica `decideAccess`. `matcher: ['/mi-cuenta/:path*', '/admin/:path*']`, así que no se ejecuta sobre `/_next/**`, imágenes, archivos públicos ni `/api/auth/**`. Sin sesión → 307 a `/login?next=<ruta>`; `CLIENTE` en `/admin` → 404 (reescritura a una ruta inexistente + evento `forbidden_access`). El comentario del archivo documenta que no es la única barrera y la regla de `getFreshUser()` para operaciones sensibles (punto 6).
- **`src/server/security/access.ts`**: `decideAccess(pathname, rol) → allow | redirectLogin | notFound` (pura, probada, incluido el caso de rol obsoleto vs. rol fresco).
- **`rate-limit.ts`**: `createRateLimiter({ limit, windowMs, maxEntries })` con `check` / `hit` / `reset` (ventana deslizante, limpieza periódica y tope de claves; 100 000 claves distintas no superan el tope). Cabecera de documentación con la limitación de proceso único y cómo sustituirlo por BD.
- **`limiters.ts`**: políticas listas para usar: login 5 fallos por correo+IP y 20 por IP en 15 min (`checkLoginAllowed`, `recordLoginFailure`, `recordLoginSuccess` —solo reinicia el par—) y registro 5 por IP por hora (`checkRegisterAllowed`, `recordRegisterAttempt`). `retryAfterSeconds` en el resultado.
- **`client-ip.ts`**: `X-Forwarded-For` solo con `TRUST_PROXY=true`; con N proxies (`TRUST_PROXY_HOPS`, por defecto 1) se toma la N-ésima entrada desde la derecha (las anteriores las controla el cliente); IP validada por formato; sin proxy confiable, valor fijo `unknown`.
- **`audit.ts`**: `logSecurityEvent` (una línea JSON, `console.warn`) y `maskEmail` (`a***@dominio.com`).
- Cabeceras de seguridad: ya existían desde F1-06; no se duplicaron.
- `README.md`: checklist de despliegue (`AUTH_SECRET`, `AUTH_TRUST_HOST`, `TRUST_PROXY`, `TRUST_PROXY_HOPS`); `.env.example` actualizado.
- Tests nuevos (30): limitador (ventanas, bloqueo, desbloqueo con reloj simulado, claves independientes, tope y limpieza), políticas de login, IP con y sin proxy, enmascarado y formato del log, `decideAccess` y `matcher`, y `requireUser`/`requireRole` sin sesión o con rol insuficiente (la comprobación dentro de la acción, sin depender del proxy).

### Pendiente: integración del limitador

**No integrado** en login ni registro: en `main` no existe ninguna de las dos acciones (F2-03 sin empezar; F2-02 está en el PR #18). El PR que primero encuentre ambos puntos de entrada debe:

1. En la acción de login: `checkLoginAllowed(email, ip)` antes de verificar; si no está permitido, `logSecurityEvent({ type: 'login_blocked', ... })` y el mensaje genérico «Demasiados intentos. Inténtalo de nuevo en unos minutos» (texto en `site-content.ts`); tras fallo `recordLoginFailure` + `login_failed`; tras éxito `recordLoginSuccess`.
2. En `registerAction` (F2-02): `checkRegisterAllowed(ip)` + `recordRegisterAttempt(ip)` + `register_blocked`.
   La IP sale de `getClientIp((await headers()))`. El orquestador debe crear el seguimiento en F2-03 (y/o F2-02) si falta alguno.

### Verificación realizada (`pnpm start`, `AUTH_TRUST_HOST=true`)

```bash
curl -si localhost:3150/mi-cuenta            # 307, location: /login?next=%2Fmi-cuenta
curl -si "localhost:3150/admin/vehiculos?x=1" # 307, location: /login?next=%2Fadmin%2Fvehiculos%3Fx%3D1
# sesión de CLIENTE (carlos.gomez@example.com, seed):
curl -si -b jar localhost:3150/admin/x        # 404 y en el log: {"channel":"security","type":"forbidden_access","userId":2,"ip":"unknown","detail":"/admin/x"}
```

`/logo.jpg` y `/api/auth/session` siguen respondiendo 200 (el proxy no se ejecuta en ellos). Con sesión, `/mi-cuenta` devuelve 404 porque la página aún no existe (F2-05). No se pudo comprobar por `curl` que `ADMIN` entra en `/admin` (tampoco existe); lo cubre el test de `decideAccess`.

### Notas

- Sin `TRUST_PROXY=true` (p. ej. en desarrollo) todos los clientes comparten el cupo `unknown`: es seguro pero restrictivo; en producción detrás del proxy debe activarse.
- Si `.next` queda de otra rama, `pnpm typecheck` puede fallar con tipos obsoletos de `.next/types`; `pnpm build` lo regenera.
