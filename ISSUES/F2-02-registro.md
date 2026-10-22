# F2-02: Registro de clientes

- **Estado:** TODO
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

## Fuera de alcance

Verificación de correo, recuperación de contraseña (pendiente de decisión del propietario sobre el proveedor de correo), CAPTCHA, limitación de intentos (F2-04), registro de ADMIN/ASESOR (los crea un administrador en la Fase 4).

## Criterios de aceptación

- [ ] Registrar un usuario nuevo desde `/registro` crea la fila con rol `CLIENTE`, `password_hash` bcrypt, teléfono con prefijo `57` y `consentimiento_datos_at` rellenado.
- [ ] Registrar con un correo o documento ya existentes muestra el mismo mensaje genérico y no crea filas duplicadas.
- [ ] El formulario funciona con JavaScript desactivado.
- [ ] `?next=//evil.com` y similares terminan en `/` (comprobado con test y a mano).
- [ ] Ningún error de servidor (500) con entradas hostiles (cadenas de 10 000 caracteres, comillas, `<script>`, emoji, bytes nulos).
- [ ] Sin scroll horizontal a 360 px; accesibilidad: cada campo con `label`, errores asociados con `aria-describedby`, foco visible.
- [ ] `pnpm check` y `pnpm build` pasan; CI en verde.
- [ ] La migración se aplica desde cero (`pnpm db:reset`) y el seed sigue funcionando.

## Verificación

```bash
pnpm db:migrate && pnpm db:seed && pnpm dev
# registrar un usuario, comprobar en BD:
docker exec jds_vehiculos_db mysql -ujds -pjds jds_vehiculos -e "SELECT id,rol_id,email,telefono,LEFT(password_hash,7),consentimiento_datos_at FROM usuarios ORDER BY id DESC LIMIT 1;"
```

## Recordatorio de proceso

Rama `issue/F2-02-registro` + PR; al terminar, estado `REVIEW`. **No fusionar ni marcar `DONE`.** Texto visible en `site-content.ts`; sin afirmaciones comerciales inventadas.
