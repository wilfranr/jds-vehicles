# F2-05: Mi cuenta (perfil y cambio de contraseña)

- **Estado:** REVIEW
- **Fase:** 2
- **Depende de:** F2-03, F2-04
- **Prioridad:** Media

## Contexto

El cliente necesita ver y mantener sus datos (el teléfono es la clave para WhatsApp) y cambiar su contraseña. Las reservas reales llegan en la Fase 3; aquí solo se deja preparada la sección. **Lee `AGENTS.md` y la documentación local de Next.**

## Alcance

1. Rutas protegidas (`requireUser()` en cada página y acción, además del proxy de F2-04), bajo `/mi-cuenta`:
   - `/mi-cuenta` (perfil): muestra nombre, apellido, tipo y número de documento (solo lectura), correo (solo lectura: cambiarlo exigiría verificación), teléfono, ciudad y dirección. Se pueden editar nombre, apellido, teléfono, ciudad y dirección con las **mismas reglas de validación y normalización de F2-02** (reutilizar el esquema, no duplicarlo; teléfono guardado con prefijo `57`).
   - `/mi-cuenta/seguridad`: cambio de contraseña. Pide contraseña actual, nueva y confirmación; verifica la actual con bcrypt, aplica la política de F2-02, guarda con coste 12. La nueva contraseña no puede ser igual a la actual. Con éxito, mostrar confirmación (la sesión actual sigue válida).
   - `/mi-cuenta/reservas`: estado vacío amable ("Aún no tienes reservas") con enlace al catálogo, preparado para la Fase 3. **No** inventar datos.
2. Layout de `/mi-cuenta` con navegación lateral/pestañas (Perfil, Seguridad, Reservas), accesible, y `noindex` en todas las páginas de la cuenta.
3. Acciones de servidor:
   - Siempre toman el id del usuario **de la sesión**, nunca de un campo del formulario (probar que enviar otro `id` en el cuerpo no tiene efecto).
   - Registrar con `logSecurityEvent` (F2-04) los cambios de contraseña (`password_changed`), sin datos sensibles.
   - Aplicar el limitador de F2-04 al cambio de contraseña (5 intentos fallidos de contraseña actual por usuario cada 15 minutos).
4. Si el usuario está `activo = false` en la BD (desactivado tras iniciar sesión), las acciones sensibles deben fallar y cerrar la sesión: usar `getFreshUser()` de F2-01 en el cambio de contraseña y en la edición de perfil.
5. Textos en `site-content.ts`. Accesibilidad: formularios con `label`, errores asociados, foco visible, sin scroll horizontal a 360 px.
6. **Tests:** esquema de edición de perfil (reutilizando el de F2-02), acción de cambio de contraseña con dependencias simuladas (actual incorrecta, nueva igual a la actual, nueva débil, éxito, usuario desactivado), garantía de que la acción ignora un `id` enviado en el formulario.

## Fuera de alcance

Cambio de correo, eliminación de cuenta, recuperación de contraseña por correo, historial de reservas con datos reales (Fase 3), foto de perfil.

## Criterios de aceptación

- [x] Sin sesión, las tres rutas redirigen a `/login?next=...`.
- [x] El cliente demo edita su teléfono (formato `+57 310 555 1234` → `573105551234`) y el cambio se refleja en la BD y en la página.
- [x] Cambiar la contraseña exige la actual correcta; tras el cambio se puede iniciar sesión con la nueva y no con la anterior.
- [x] Un usuario no puede modificar a otro (probar manipulando el cuerpo del formulario).
- [x] Las páginas de cuenta llevan `noindex` y no aparecen en el sitemap.
- [x] `pnpm check` y `pnpm build` pasan en local; CI: ver el PR.

## Verificación

`pnpm db:seed && pnpm dev`: iniciar sesión con el cliente demo, editar el perfil, cambiar la contraseña y volver a entrar; restaurar la contraseña del seed al terminar (`pnpm db:seed`).

## Recordatorio de proceso

Rama `issue/F2-05-mi-cuenta` + PR; al terminar, estado `REVIEW`. **No fusionar ni marcar `DONE`.**

## Notas de entrega

**Qué se hizo**

- **Rutas** (`src/app/(account)/mi-cuenta/`): `/mi-cuenta` (perfil), `/seguridad` y `/reservas`. Cada página llama a `requireUser()`; además las protege el proxy. El layout lleva navegación accesible (`aria-current`, pestañas con scroll interno en móvil, lista lateral en escritorio) y `robots: noindex`. No están en el sitemap.
- **Perfil:** documento y correo en solo lectura; nombre, apellido, teléfono, ciudad y dirección editables. El esquema se **reutiliza** del registro: `createProfileShape` (en `src/lib/validation/register.ts`) alimenta tanto `createRegisterSchema` como `createProfileSchema`, y `createPasswordRule` es la misma regla de contraseña para registro y cambio.
- **Contraseña:** `submitChangePassword` (`src/server/account/change-password.ts`, inyectable). Orden: usuario vigente (`getFreshUser`) → límite → validación → contraseña actual → nueva distinta → hash (coste 12) y guardado. La validación va antes de comprobar la actual, así que una contraseña nueva débil no sirve de oráculo.
- **Límite:** 5 fallos de contraseña actual por usuario cada 15 min (`checkPasswordChangeAllowed` en `limiters.ts`). Un cambio correcto reinicia el contador.
- **Seguridad:** el id sale siempre de la sesión; los formularios solo leen campos conocidos (`rawFormInput`), así que un `id` en el cuerpo no se lee. Eventos `password_changed`, `password_change_failed` y `password_change_blocked` con `logSecurityEvent`, sin contraseñas, hashes ni correos.
- **Usuario desactivado:** ambas acciones usan `getFreshUser()`; si devuelve `null` se cierra la sesión (`signOut`) y se redirige a `/login`.
- **Reservas:** solo estado vacío («Aún no tienes reservas») con enlace al catálogo. Sin datos inventados.
- **Textos:** todos en `site-content.ts` (`cuenta`).

**Tests (197 en 29 archivos, todos en verde)**: esquema de perfil (normalización `+57 310 555 1234` → `573105551234`, mismas reglas que el registro, campos ajenos descartados), esquema de cambio de contraseña, `submitProfileUpdate`, `submitChangePassword` (actual incorrecta, igual a la actual, débil, confirmación distinta, éxito, desactivado, límite, `id` ignorado, el log no contiene secretos) y el limitador.

**Verificado a mano** (build de producción + Playwright contra la BD sembrada): sin sesión las tres rutas redirigen a `/login?next=…`; editar el teléfono lo guarda como `573202223344` y la página lo refleja; con `id=1` inyectado en el formulario solo cambia el usuario de la sesión (el admin queda intacto); la contraseña anterior deja de servir y la nueva sí; el sexto intento se bloquea aunque la actual sea correcta; un usuario puesto `activo=0` con sesión abierta pierde la sesión al intentar cambiar la contraseña; sin scroll horizontal a 360 px; `noindex` presente. Datos del seed restaurados con `pnpm db:seed`.

**Desviaciones y puntos a revisar**

- **Sin JavaScript las páginas de cuenta no se ven:** son dinámicas (leen cookies) y su contenido llega en streaming bajo `loading.tsx`; sin JS el navegador no lo revela. Es la misma limitación de `/vehiculos/[id]` (ya anotada en F2-03). `/login` y `/registro` siguen funcionando sin JS. No hay validación en el cliente en estos formularios: manda el servidor.
- **Nombre en el header:** el JWT guarda el nombre del inicio de sesión; si se edita el perfil, el menú muestra el nombre anterior hasta volver a iniciar sesión. Arreglarlo exige `update()` de Auth.js y un callback `jwt` con `trigger: 'update'`; no se hizo para no ampliar el alcance.
- **Cuenta desactivada con sesión vigente:** al visitar `/mi-cuenta` (no una acción) responde 404, porque un Server Component no puede borrar la cookie y redirigir a `/login` provocaría un bucle con el proxy. La sesión se cierra en cuanto intenta guardar algo.
- **Ayuda «para corregir tu documento o correo»:** apunta a `/contacto`; no se prometió ningún plazo ni proceso.
- El panel `/admin` y el cambio del correo siguen fuera de alcance.

**Cómo verificar**: `pnpm check && pnpm build`; `pnpm db:seed && pnpm start` (con `AUTH_TRUST_HOST=true`), entrar con `carlos.gomez@example.com` / `Cliente123*`, editar el perfil y cambiar la contraseña; al terminar `pnpm db:seed` restaura el usuario.
