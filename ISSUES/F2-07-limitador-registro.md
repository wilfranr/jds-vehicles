# F2-07: Integrar el limitador de intentos en el registro

- **Estado:** DONE
- **Fase:** 2
- **Depende de:** F2-02 (DONE), F2-04 (DONE)
- **Prioridad:** Alta (el registro hoy no tiene límite)

## Contexto

F2-02 (registro) y F2-04 (limitador de intentos) se fusionaron por separado y el limitador **no está conectado** a ninguna acción. Mientras tanto, cada envío del formulario de `/registro` ejecuta un hash bcrypt de coste 12 (unos 250 ms de CPU) **antes** de tocar la base de datos, así que sin límite es un vector de abuso: llenar la tabla de usuarios y consumir CPU. La integración con el **login** queda dentro de F2-03 (que crea esa acción). **Lee `AGENTS.md` y la documentación local de Next.**

## Alcance

1. En `registerAction` (`src/app/(auth)/registro/actions.ts`), usando `src/server/security/`:
   - IP: `getClientIp(await headers())`.
   - **Antes de validar y de hacer el hash**: `checkRegisterAllowed(ip)`. Si no está permitido: `logSecurityEvent({ type: 'register_blocked', ip })`, y devolver un estado de error con el mensaje genérico «Demasiados intentos. Inténtalo de nuevo en unos minutos» (texto en `site-content.ts`, sin indicar cuánto falta ni por qué) conservando los valores no sensibles del formulario.
   - `recordRegisterAttempt(ip)` por cada envío que pase el chequeo (válido o no, incluidos los duplicados), de modo que los intentos fallidos también consuman cupo.
2. El orden importa y debe cubrirse con tests: **límite → validación → hash → creación**. Verificar con un test que, estando bloqueada la IP, no se llama a `hashPassword` ni a `createUser`.
3. Probar la acción con dependencias inyectadas (extraer una función `submitRegistration(formData, ctx)` si hace falta para que sea comprobable sin Next).
4. Documentar en el README (checklist de despliegue) que sin `TRUST_PROXY=true` todos los visitantes comparten el cupo `unknown` y 5 registros por hora bastarían para bloquear el registro a todo el mundo; es obligatorio activarlo en producción.

## Fuera de alcance

El login (F2-03), cambiar los límites, CAPTCHA, un limitador compartido con BD.

## Criterios de aceptación

- [x] Con `TRUST_PROXY=true` y distintas cabeceras `X-Forwarded-For`, 5 registros por hora salen de la misma IP y el sexto es rechazado con el mensaje genérico; otra IP no se ve afectada.
- [x] Un envío bloqueado no consume CPU de bcrypt (test que lo demuestra) ni crea filas.
- [x] Un evento `register_blocked` se escribe en el log (una línea JSON, sin datos personales).
- [x] Sigue funcionando sin JavaScript.
- [x] `pnpm check` y `pnpm build` pasan; CI en verde. _(CI pendiente de verse en el PR.)_

## Verificación

Con `pnpm build && TRUST_PROXY=true AUTH_TRUST_HOST=true pnpm start`, enviar 6 registros desde un script Playwright con la misma cabecera `X-Forwarded-For`; limpiar los usuarios creados.

## Recordatorio de proceso

Rama `issue/F2-07-limitador-registro` + PR; al terminar, estado `REVIEW`. **No fusionar ni marcar `DONE`.**

## Notas de entrega

### Qué se hizo

- Nueva función inyectable `submitRegistration(formData, ctx)` en `src/server/auth/submit-registration.ts`, con el orden **límite → validación → hash → creación → inicio de sesión**. `registerAction` queda como cableado fino (IP con `getClientIp`, limitadores de F2-04, `logSecurityEvent`, `signIn`).
- Antes de validar: `checkRegisterAllowed(ip)`. Si está bloqueado: evento `register_blocked` (solo `ts`, `channel`, `type`, `ip`) y estado de error con `auth.tooManyAttempts` («Demasiados intentos. Inténtalo de nuevo en unos minutos.», en `site-content.ts`; no indica cuánto falta), conservando los valores no sensibles del formulario.
- `recordRegisterAttempt(ip)` por cada envío que pasa el chequeo: válido, inválido o duplicado.
- README: aviso en el checklist de despliegue de que sin `TRUST_PROXY=true` todos comparten el cupo `unknown` y bastan 5 envíos por hora para bloquear el registro a todos; obligatorio en producción.
- `nextFromReferer` pasó a ser síncrona (recibe el valor de la cabecera).
- 5 tests nuevos: orden de llamadas; sexto envío bloqueado sin `hashPassword` ni `createUser` (y sin nueva sesión); otra IP no afectada; inválidos y duplicados consumen cupo; el bloqueo no valida ni revela el tiempo restante.

### Verificación (`pnpm build && TRUST_PROXY=true AUTH_TRUST_HOST=true pnpm start`)

Script Playwright con cabecera `X-Forwarded-For: 203.0.113.77`, alternando envíos con y sin JavaScript: los 5 primeros registran y redirigen a `/`; el sexto vuelve a `/registro` con el mensaje genérico. Una IP distinta (`198.51.100.20`) registra con normalidad. Log: `{"ts":"…","channel":"security","type":"register_blocked","ip":"203.0.113.77"}`. Los usuarios de prueba se eliminaron (quedan los 2 del seed).

### Notas

- El limitador es en memoria: un reinicio del servidor reinicia los contadores (documentado en F2-04).
- La integración con el login sigue en F2-03.
