# F4-06: Gestión de usuarios (solo ADMIN)

- **Estado:** TODO
- **Fase:** 4
- **Depende de:** F4-01
- **Prioridad:** Media

## Contexto

Mientras no haya recuperación de contraseña por correo (proveedor pendiente), el administrador debe poder atender a un cliente que perdió su clave. El JWT de Auth.js no se revoca: desactivar un usuario debe surtir efecto en sus acciones sensibles (`getFreshUser()`, ya usado en cuenta y reservas).

**Requisitos de seguridad comunes a toda la Fase 4:** (1) cada página y cada Server Action llama a `requireRole(...)` (además del proxy); el rol sale de la sesión/BD, nunca del formulario; (2) las acciones sensibles usan `getFreshUser()` (el JWT no se revoca); (3) listas explícitas de campos editables (nada de pasar el cuerpo del formulario a Prisma); (4) validación con Zod en servidor; (5) cada cambio relevante escribe un evento de auditoría de una línea JSON (quién, qué, id afectado; sin datos personales ni secretos); (6) los textos y avisos nunca revelan si un registro ajeno existe.

## Alcance

1. `/admin/usuarios` (**solo ADMIN**, `requireAdmin()`): tabla paginada con búsqueda por nombre/correo (parametrizada), rol, estado y fecha de alta; el documento se muestra enmascarado.
2. Acciones, todas de servidor y con auditoría: **activar/desactivar** cuenta, **cambiar rol** (CLIENTE/ASESOR/ADMIN) y **restablecer contraseña**. El restablecimiento genera una contraseña temporal aleatoria (`crypto`, 14+ caracteres que cumplan la política de F2-02), la guarda con bcrypt coste 12 y se **muestra una sola vez** al administrador (no se registra en logs ni se guarda en claro). Mensaje que pide comunicarla por un canal seguro y que el cliente la cambie en "Mi cuenta".
3. **Salvaguardas** (probadas): un administrador no puede desactivarse a sí mismo ni quitarse el rol ADMIN; nunca puede quedar el sistema sin al menos un ADMIN activo (comprobar dentro de la transacción con bloqueo, para que dos administradores no se dejen mutuamente sin acceso).
4. Al desactivar, las reservas activas del usuario **no** se cancelan automáticamente (mostrar aviso con enlace a ellas).
5. Limitador de F2-04 para el restablecimiento de contraseña por administrador (p. ej. 10 por hora) y eventos `user_deactivated`, `user_role_changed`, `user_password_reset` (sin la contraseña).
6. **Tests:** cada acción, las salvaguardas (auto-desactivación, último ADMIN, carrera de dos administradores), que ASESOR y CLIENTE obtienen 404, que la contraseña temporal cumple la política y no aparece en los logs, y que un usuario desactivado no puede iniciar sesión ni usar acciones sensibles.

## Fuera de alcance

Crear usuarios desde el panel, eliminar usuarios, correo electrónico, autenticación de dos factores.

## Criterios de aceptación

- [ ] Restablecer la clave de una cuenta de prueba permite entrar con la temporal y no con la anterior.
- [ ] Desactivar la cuenta de prueba impide iniciar sesión.
- [ ] El único ADMIN no puede desactivarse ni degradarse.
- [ ] `pnpm check`, `pnpm build` y `pnpm test:e2e` pasan; CI en verde.

## Recordatorio de proceso

Rama `issue/<ID>-<slug>` **creada desde `main` actualizado** (`git checkout main && git pull`), nunca encadenada sobre otra rama sin fusionar; si dependes de un issue que aún no está en `main`, espera. PR al terminar y estado `REVIEW`. **No fusionar ni marcar `DONE`.** Texto visible en `site-content.ts`, sin afirmaciones comerciales inventadas. **Lee `AGENTS.md` y la documentación local de Next antes de escribir código.**
