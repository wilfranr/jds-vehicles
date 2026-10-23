# F2-06: Pruebas end-to-end de autenticación y cierre de la Fase 2

- **Estado:** REVIEW
- **Fase:** 2
- **Depende de:** F2-05, **F1-06 fusionado** (introduce Playwright y el job de e2e en CI)
- **Prioridad:** Media

## Contexto

La autenticación es una zona de riesgo: una regresión aquí abre o cierra el acceso a todo el sistema. Esta issue cubre los recorridos completos con navegador real y revisa que la Fase 2 quede coherente. **Lee `AGENTS.md`.**

## Alcance

1. Pruebas Playwright en `e2e/auth.spec.ts` (reutilizando la configuración, el servidor y el sembrado de datos que dejó F1-06):
   - **Registro → sesión → mi cuenta → cerrar sesión:** un usuario nuevo con correo único (generado por la prueba) queda con sesión, ve su nombre en el header, entra a `/mi-cuenta`, cierra sesión y vuelve a ver "Iniciar sesión". Limpiar el usuario creado al terminar.
   - **Login incorrecto:** mensaje genérico idéntico con correo inexistente y con contraseña errónea.
   - **Ruta protegida:** `/mi-cuenta` sin sesión → `/login?next=%2Fmi-cuenta`; tras iniciar sesión vuelve a `/mi-cuenta`.
   - **`next` hostil:** `/login?next=//evil.com` y `?next=https://evil.com` terminan en el propio sitio.
   - **Rol:** un `CLIENTE` no accede a `/admin` (404/403 según lo decidido en F2-01/F2-04).
   - **Reserva futura:** en `/vehiculos/<id>` de un vehículo disponible, sin sesión aparece "Inicia sesión para reservar" y lleva a `/login?next=/vehiculos/<id>`.
   - **Límite de intentos:** 6 intentos de login fallidos seguidos con el mismo correo muestran el mensaje de "Demasiados intentos"; usar un correo único por prueba para no bloquear al cliente demo, y reiniciar el limitador entre pruebas (exponer un reinicio solo en entorno de test, nunca en producción).
2. Cambio de contraseña en e2e: cambiar, cerrar sesión y entrar con la nueva; limpiar o restaurar el estado.
3. Actualizar el job de CI de e2e para que incluya `auth.spec.ts`; si en F1-06 quedó como opcional (`continue-on-error`), valorar volverlo obligatorio y anotar la decisión.
4. **Revisión de cierre de la Fase 2** (anotar en `Notas de entrega`):
   - Comprobar que ninguna página pública se volvió dinámica por leer la sesión (resumen de `pnpm build` comparado con el de antes de la Fase 2).
   - Buscar en `src` rastros de contraseñas o hashes en logs o respuestas (`grep -rn "passwordHash\|password_hash" src`) y listar los usos legítimos.
   - Confirmar que `README.md` documenta: variables de autenticación, cómo crear usuarios de prueba y cómo correr los e2e.
5. Actualizar `README.md` con la lista de rutas de autenticación y de cuenta.

6. **Variantes de ruta del proxy.** `/admin` aún no existe, así que las pruebas de F2-04 no pueden distinguir si el proxy intercepta `/%61dmin/x`, `/admin%2fx` o `/ADMIN/x` o si simplemente no hay página. Cuando exista `/admin` (Fase 4) hay que repetir esa comprobación; hasta entonces dejar un test marcado `test.fixme` que documente las rutas a verificar, y recordar que cada página de `/admin` debe llamar a `requireRole()` además del proxy.

## Fuera de alcance

Pruebas de carga, pruebas de penetración, pruebas del panel de administración (Fase 4).

## Criterios de aceptación

- [x] `pnpm e2e` pasa en local con la BD sembrada, incluidos los 7 recorridos anteriores.
- [x] Las pruebas no dejan datos residuales (comprobar el conteo de `usuarios` antes y después).
- [x] El job de CI ejecuta `auth.spec.ts`.
- [x] Las observaciones de la revisión de cierre quedan anotadas.
- [x] `pnpm check` y `pnpm build` pasan en local; CI: ver el PR.

## Verificación

```bash
pnpm db:reset && pnpm e2e
docker exec jds_vehiculos_db mysql -ujds -pjds jds_vehiculos -e "SELECT COUNT(*) FROM usuarios;"   # sin cambios
```

## Recordatorio de proceso

Rama `issue/F2-06-e2e-auth` + PR; al terminar, estado `REVIEW`. **No fusionar ni marcar `DONE`.**

## Observación de la revisión de F2-03 (añadida por el orquestador)

Con sesión iniciada, el DOM contiene dos elementos `<header>`: el visible y uno con tamaño 0 (resto oculto del streaming de la carcasa parcial). Sin sesión hay uno solo. No es visible ni accesible, pero el e2e debe usar `getByRole('banner')` (no `locator('header')`, que da "strict mode violation") y, si es posible, averiguar por qué el segundo no se elimina tras la hidratación.

## Notas de entrega

**Qué se hizo**

- `e2e/auth.spec.ts` (13 pruebas + 1 `test.fixme`): registro → sesión → mi cuenta → cierre de sesión; login incorrecto con mensaje idéntico (correo inexistente vs. contraseña errónea); ruta protegida con vuelta tras iniciar sesión; `next` hostil (`//evil.com`, `https://evil.com`, `/\evil.com`); `CLIENTE` en `/admin` → 404; «Inicia sesión para reservar» en `/vehiculos/1` → `/login?next=%2Fvehiculos%2F1`; límite de intentos (sexto fallo → «Demasiados intentos»); cambio de contraseña (la anterior deja de servir, la nueva sí).
- `test.fixme` «variantes de /admin no eluden el proxy (Fase 4)» con las rutas a verificar (`/%61dmin/x`, `/admin%2fx`, `/ADMIN/x`, `/admin//x`, `/admin/../admin/x`) y el recordatorio de que cada página de `/admin` llame a `requireRole()`.
- `e2e/global-setup.ts`: cuenta `usuarios` antes y después de toda la ejecución y falla si cambia. Cada worker borra además los usuarios que creó.
- CI: el job de e2e deja de ser `continue-on-error` (ahora es obligatorio). Decisión: 5 ejecuciones seguidas en local pasaron 14/14 y 0 residuos, y la Fase 3 depende de estas pruebas.
- README: usuarios de prueba, cómo correr los e2e, tabla de rutas de autenticación y de cuenta.

**Desviación: sin reinicio del limitador.** El issue pedía exponer un reinicio solo en test. No lo hice: es una superficie nueva que no debería existir cerca de producción. En su lugar el servidor de e2e arranca con `TRUST_PROXY=true` y cada prueba envía una IP única en `X-Forwarded-For`; los cupos (registro 5/h por IP, login por correo+IP) nunca se comparten ni entre pruebas ni entre ejecuciones. Con `E2E_BASE_URL` el servidor debe tener `TRUST_PROXY=true` (documentado).

**Errores reales que encontraron los e2e (corregidos)**

- **Bug de F2-03:** `MobileAccount` (componente de servidor) importaba `accountLinks` desde `UserMenu.tsx` (`'use client'`) y lo llamaba en el servidor: con sesión iniciada, el servidor registraba `Attempted to call accountLinks() from the server…` y la sección de cuenta del menú móvil fallaba. Moví `accountLinks` y `displayFirstName` a `src/components/layout/account-links.ts` (sin directiva de cliente).
- **Fragilidad del e2e de catálogo:** el clic en la galería podía llegar antes de la hidratación bajo carga (falló 2 de 3 veces al correr en paralelo con las pruebas nuevas). Ahora se reintenta con `expect(...).toPass()`.
- El formulario de login se reinicia al terminar la acción de React; la prueba del límite espera ese reinicio antes de cada envío.

**Revisión de cierre de la Fase 2**

- **Páginas públicas:** ninguna es dinámica (`ƒ`). Antes de la Fase 2 eran `○` estáticas; ahora `/`, `/catalogo`, `/proximamente`, `/como-funciona`, `/contacto` y `/vehiculos/[id]` son `◐` (carcasa estática + cuenta del header en streaming). `/login` y `/registro` siguen `○`. `/mi-cuenta/**` es `◐` con contenido dinámico bajo `loading.tsx`. Solo `/api/auth/[...nextauth]` y `/api/health` son `ƒ`.
- **Contraseñas y hashes** (`grep -rn "passwordHash\|password_hash" src`, sin tests): `verify-credentials.ts` (compara con el hash; hash ficticio si no existe el usuario), `register.ts` (guarda el hash recién generado) y `mi-cuenta/seguridad/actions.ts` (lee el hash para verificar la actual y guarda el nuevo). Ningún uso lo devuelve en respuestas ni lo registra: los eventos de seguridad llevan solo tipo, IP, id de usuario y correo enmascarado (comprobado en las pruebas de `password_changed`). Los logs de e2e muestran solo `e***@example.com`.
- **README** documenta variables de autenticación (`AUTH_SECRET`, `AUTH_TRUST_HOST`, `TRUST_PROXY*`), usuarios de prueba y e2e.
- **Segundo `<header>` con sesión** (observación de F2-03): las pruebas usan `getByRole('banner')`, que solo ve el accesible. No investigué por qué el segundo no se elimina tras la hidratación.

**Para revisar**

- **Error en logs del servidor de producción:** `Route "/": Next.js encountered the unstable value crypto.getRandomValues() while prerendering` (y lo mismo en `/catalogo`, `/vehiculos/[id]`, `/mi-cuenta`). Viene de `auth()` de Auth.js (generación de token CSRF, `createCSRFToken`) ejecutándose en el render de la carcasa parcial. Las páginas responden 200 y no apareció en `pnpm build`; no verifiqué si ya ocurría en `main` desde F2-03. Conviene un issue para eliminarlo (p. ej. leer la sesión con `getToken`/cookie en lugar de `auth()` en el header).

**Cómo verificar**: `pnpm db:seed && pnpm build && pnpm e2e` (repetir varias veces) y `SELECT COUNT(*) FROM usuarios;` sin cambios.
