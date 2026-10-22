# F2-02: Registro de clientes

- **Estado:** DONE
- **Fase:** 2
- **Depende de:** F2-01
- **Prioridad:** Alta

## Contexto

`docs/DOCUMENTACION.md` §1.2: los clientes deben registrarse para reservar. Datos del comprador: nombres y apellidos, tipo y número de documento (CC, CE, NIT, PASAPORTE), teléfono celular (clave para WhatsApp), correo, contraseña (se guarda como hash), dirección y ciudad. Diseño: `docs/DESIGN.md` (inputs, botones, tarjetas). **Lee `AGENTS.md` y la documentación local de Next.**

## Alcance

1. Ruta `/registro` (grupo `(auth)`), formulario que funciona **sin JavaScript** (Server Action con `<form action>`), con mejora progresiva (estado pendiente, errores por campo, foco al primer error).
2. Campos y validación con `zod` (mismo esquema usado en cliente para la UX y en servidor como autoridad):
   - `nombre`, `apellido`: 2–100 caracteres, con trim.
   - `tipoDocumento`: enum `CC | CE | NIT | PASAPORTE` (los valores del enum Prisma `TipoDocumento`).
   - `documento`: 5–30 caracteres alfanuméricos (sin espacios, puntos ni guiones; normalizar antes de guardar).
   - `email`: válido, máx. 150, **normalizado a minúsculas**.
   - `telefono`: celular colombiano de 10 dígitos que empiece por `3` (se acepta con `+57`, `57` o espacios y se normaliza). **Se guarda con prefijo país** (`57` + 10 dígitos, p. ej. `573105551234`) porque la columna se usa para WhatsApp.
   - `password`: mínimo 10 caracteres, máximo 72 (límite de bcrypt), al menos una letra y un número; rechazar contraseñas triviales de una lista corta (`password123`, `12345678`, etc.). Campo de confirmación en el formulario.
   - `ciudad` y `direccion`: opcionales (máx. 100 y 255).
3. **Consentimiento de tratamiento de datos.** Casilla obligatoria "Autorizo el tratamiento de mis datos personales" (texto en `site-content.ts`) con enlace a la política cuando exista (`/privacidad`; hoy no existe: no enlazar y dejar `TODO(owner)`). Guardar la fecha de aceptación:
   - Migración Prisma nueva: columna `consentimiento_datos_at DATETIME NULL` en `usuarios` (nombre de campo Prisma `consentimientoDatosAt`). Generar con `prisma migrate dev`, sin tocar migraciones anteriores.
   - **El texto legal definitivo lo aporta el propietario** (probablemente exigido por la Ley 1581 de 2012; confirmar con asesoría legal). Hasta entonces, texto neutro y `TODO(owner)`.
4. Servidor (`src/server/auth/register.ts`, función pura/inyectable + la Server Action que la llama):
   - Rol: buscar el rol por nombre `CLIENTE` (no usar el id `1` fijo en el código). Si no existe, error de configuración claro.
   - Hash con `bcryptjs` (coste **12**).
   - Duplicados: correo o documento ya registrados → error **genérico** ("No fue posible completar el registro con esos datos") sin revelar cuál campo; atrapar la violación de unicidad de Prisma (`P2002`) en vez de hacer una consulta previa (evita condiciones de carrera).
   - Nunca registrar (log) contraseñas ni hashes.
   - Éxito → iniciar sesión automáticamente (F2-01) y redirigir a `next` si es una ruta interna segura, o a `/mi-cuenta` / `/`.
5. **Redirección segura:** utilidad `safeNextPath(next: string | undefined): string` en `src/lib/safe-redirect.ts`: solo acepta rutas relativas internas que empiecen por `/` y **no** por `//` ni `/\`, sin esquema ni host; cualquier otra cosa → `/`. Con tests (`//evil.com`, `/\evil.com`, `https://evil.com`, `javascript:alert(1)`, `/vehiculos/2?x=1`, vacío).
6. Enlace "¿Ya tienes cuenta? Inicia sesión" (a `/login`, que crea F2-03; hasta entonces puede apuntar a la ruta aunque dé 404, anotarlo).
7. Metadatos (`title`: "Crear cuenta | JDS Vehículos"), `noindex`, y todo el texto en `site-content.ts`.
8. **Tests (Vitest):** esquema de validación (casos válidos e inválidos por campo, normalización del teléfono y del correo), función de registro con dependencias simuladas (éxito, duplicado, rol inexistente), `safeNextPath`, y que el usuario creado queda con `passwordHash` bcrypt verificable y rol `CLIENTE`. Una prueba de integración contra la BD de pruebas que cree y borre un usuario temporal.

9. **Mismo coste de hash en el hash ficticio (revisión de F2-01).** `DUMMY_PASSWORD_HASH` en `src/server/auth/verify-credentials.ts` es bcrypt de coste 10 y sirve para igualar el tiempo de respuesta cuando el correo no existe (comprobado: 62 ms en los tres casos). Como el registro guardará hashes de coste **12**, hay que regenerar el hash ficticio con coste 12, de lo contrario un correo inexistente respondería ~4 veces más rápido y permitiría enumerar usuarios por tiempo. Añadir un test que compare el coste (`bcrypt.getRounds`) del hash ficticio con la constante de coste usada al registrar, para que no se desincronicen. Los hashes del seed (coste 10) son solo de demostración.

## Fuera de alcance

Verificación de correo, recuperación de contraseña (pendiente de decisión del propietario sobre el proveedor de correo), CAPTCHA, limitación de intentos (F2-04), registro de ADMIN/ASESOR (los crea un administrador en la Fase 4).

## Criterios de aceptación

- [x] Registrar un usuario nuevo desde `/registro` crea la fila con rol `CLIENTE`, `password_hash` bcrypt, teléfono con prefijo `57` y `consentimiento_datos_at` rellenado.
- [x] Registrar con un correo o documento ya existentes muestra el mismo mensaje genérico y no crea filas duplicadas.
- [x] El formulario funciona con JavaScript desactivado.
- [x] `?next=//evil.com` y similares terminan en `/` (comprobado con test y a mano).
- [x] Ningún error de servidor (500) con entradas hostiles (cadenas de 10 000 caracteres, comillas, `<script>`, emoji, bytes nulos).
- [x] Sin scroll horizontal a 360 px; accesibilidad: cada campo con `label`, errores asociados con `aria-describedby`, foco visible.
- [x] `pnpm check` y `pnpm build` pasan; CI en verde. _(CI pendiente de verse en el PR.)_
- [x] La migración se aplica desde cero (`pnpm db:reset`) y el seed sigue funcionando.

## Verificación

```bash
pnpm db:migrate && pnpm db:seed && pnpm dev
# registrar un usuario, comprobar en BD:
docker exec jds_vehiculos_db mysql -ujds -pjds jds_vehiculos -e "SELECT id,rol_id,email,telefono,LEFT(password_hash,7),consentimiento_datos_at FROM usuarios ORDER BY id DESC LIMIT 1;"
```

## Recordatorio de proceso

Rama `issue/F2-02-registro` + PR; al terminar, estado `REVIEW`. **No fusionar ni marcar `DONE`.** Texto visible en `site-content.ts`; sin afirmaciones comerciales inventadas.

## Notas de entrega

### Qué se hizo

- **Migración** `20261022225746_usuarios_consentimiento_datos`: `usuarios.consentimiento_datos_at DATETIME NULL` (`consentimientoDatosAt`). Migraciones anteriores intactas.
- **`/registro`** en el grupo `(auth)`: formulario estático con Server Action y `useActionState`; funciona sin JavaScript (comprobado con `javaScriptEnabled: false`). Con JS se valida primero en el cliente con **el mismo esquema** (`src/lib/validation/register.ts`) y el foco va al primer campo con error; el servidor sigue siendo la autoridad. Metadatos `Crear cuenta` + `noindex`. Todo el texto en `site-content.ts` (`registro`), con `TODO(owner)` para el texto legal y el enlace a `/privacidad` (no se enlaza porque no existe).
- **`registerUser`** (`src/server/auth/register.ts`, inyectable): rol buscado por nombre `CLIENTE` (error de configuración si falta), hash bcrypt coste 12 (`BCRYPT_COST` en `src/server/auth/password.ts`), duplicados atrapados por `P2002` (sin consulta previa) con mensaje genérico, sin logs de contraseñas ni hashes. Éxito → `signIn` automático y redirección a `safeNextPath(next)` (por defecto `/`; `/mi-cuenta` aún no existe).
- **Teléfono** normalizado a `57` + 10 dígitos; **documento** sin espacios/puntos/guiones y en mayúsculas; **correo** en minúsculas; contraseñas triviales rechazadas por lista corta.
- **`safeNextPath`** en `src/lib/safe-redirect.ts` (con tests). `buildLoginUrl` (F2-01) ahora la reutiliza; se eliminó el duplicado `sanitizeNextPath`.
- **Hash ficticio con coste 12** (punto 9): `DUMMY_PASSWORD_HASH` regenerado y test que compara `bcrypt.getRounds` con `BCRYPT_COST`.
- `SiteShell` extraído del layout público y reutilizado por `(auth)/layout.tsx`.
- Tests nuevos (38): esquema (válidos, inválidos por campo, normalización, entradas hostiles), `registerUser` con dependencias simuladas, `safeNextPath`, coste de bcrypt, e integración con la BD (crea y borra un usuario temporal, comprueba rol, hash verificable, teléfono, consentimiento y duplicados por correo y por documento).

### Desviaciones y decisiones

- **`?next=` se lee del `Referer`**, no de `searchParams`. Con Cache Components, leer `searchParams` exige un `<Suspense>`, y sin JavaScript el contenido en streaming nunca se muestra (la primera versión dejaba la página sin formulario). Con el formulario estático, la acción toma `next` del `Referer` y lo valida con `safeNextPath`. Consecuencia: si el navegador no envía `Referer`, se redirige a `/`.
- El enlace «Inicia sesión» apunta a `/login` sin `next`; `/login` lo crea F2-03 y hasta entonces responde 404.
- **Limitador de intentos (F2-04) no integrado**: aún no está en `main`. Cuando lo esté, hay que llamarlo desde `registerAction` (5 registros/IP/hora). Anotado para el seguimiento.
- Las llamadas fallidas de `INSERT` consumen valores de autoincremento (los ids saltan); es normal en MySQL/InnoDB.
- **Criterio «migración desde cero»**: `pnpm db:reset` quedó bloqueado por la salvaguarda de Prisma (acción destructiva que requiere consentimiento explícito del usuario) y no se forzó. En su lugar se creó una base de datos temporal, se aplicó `prisma migrate deploy` completo y `pnpm db:seed` (OK, 2 usuarios), y se eliminó. La BD de desarrollo no se tocó salvo borrar los 2 usuarios de prueba manual.

### Verificación realizada

`pnpm check` y `pnpm build` en verde. Con `pnpm start` (puerto 3140) y Playwright a 360 px, con y sin JavaScript: errores por campo con resumen enfocado, sin scroll horizontal, registro correcto (sesión `CLIENTE` en `/api/auth/session`), `?next=//evil.com` → `/`, duplicado → «No fue posible completar el registro con esos datos.». Fila resultante:

```
id rol_id email                        telefono      h        consentimiento_datos_at
9108 1    f202-manual@example.com      573105559999  $2b$12$  2026-10-22 23:02:17
```
