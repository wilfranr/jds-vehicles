# F2-05: Mi cuenta (perfil y cambio de contraseña)

- **Estado:** TODO
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

- [ ] Sin sesión, las tres rutas redirigen a `/login?next=...`.
- [ ] El cliente demo edita su teléfono (formato `+57 310 555 1234` → `573105551234`) y el cambio se refleja en la BD y en la página.
- [ ] Cambiar la contraseña exige la actual correcta; tras el cambio se puede iniciar sesión con la nueva y no con la anterior.
- [ ] Un usuario no puede modificar a otro (probar manipulando el cuerpo del formulario).
- [ ] Las páginas de cuenta llevan `noindex` y no aparecen en el sitemap.
- [ ] `pnpm check` y `pnpm build` pasan; CI en verde.

## Verificación

`pnpm db:seed && pnpm dev`: iniciar sesión con el cliente demo, editar el perfil, cambiar la contraseña y volver a entrar; restaurar la contraseña del seed al terminar (`pnpm db:seed`).

## Recordatorio de proceso

Rama `issue/F2-05-mi-cuenta` + PR; al terminar, estado `REVIEW`. **No fusionar ni marcar `DONE`.**
