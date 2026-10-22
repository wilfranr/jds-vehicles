# F2-04: Protección de rutas y limitación de intentos

- **Estado:** TODO
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

- [ ] Sin sesión, `/mi-cuenta` redirige a `/login?next=%2Fmi-cuenta` (con `curl -i` se ve el 307/302).
- [ ] Con sesión de `CLIENTE`, `/admin` no es accesible; con `ADMIN` sí podrá serlo cuando exista (comprobado por el test de `decideAccess`).
- [ ] Tras 5 intentos fallidos de login con el mismo par correo+IP, el sexto es bloqueado aunque se use la contraseña correcta, y se desbloquea al pasar la ventana (test con reloj simulado).
- [ ] El limitador no crece sin límite (test con 100 000 claves distintas).
- [ ] Los registros de seguridad no contienen contraseñas ni correos completos.
- [ ] El proxy no se ejecuta en `/_next/**`, imágenes ni `/api/auth/**` (comprobar el `matcher`).
- [ ] `pnpm check` y `pnpm build` pasan; CI en verde.

## Verificación

```bash
pnpm check && pnpm build && pnpm start &
curl -si localhost:3000/mi-cuenta | head -5
for i in 1 2 3 4 5 6; do curl -s -o /dev/null -w "%{http_code}\n" -X POST ... ; done   # documentar el comando real
```

## Recordatorio de proceso

Rama `issue/F2-04-seguridad-rutas-limites` + PR; al terminar, estado `REVIEW`. **No fusionar ni marcar `DONE`.**
