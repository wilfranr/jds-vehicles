# F4-06: Gestión de usuarios (solo ADMIN)

- **Estado:** REVIEW
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

- [x] Restablecer la clave de una cuenta de prueba permite entrar con la temporal y no con la anterior.
- [x] Desactivar la cuenta de prueba impide iniciar sesión.
- [x] El único ADMIN no puede desactivarse ni degradarse.
- [x] `pnpm check`, `pnpm build` y `pnpm test:e2e` pasan en local; CI: ver el PR.

## Recordatorio de proceso

Rama `issue/<ID>-<slug>` **creada desde `main` actualizado** (`git checkout main && git pull`), nunca encadenada sobre otra rama sin fusionar; si dependes de un issue que aún no está en `main`, espera. PR al terminar y estado `REVIEW`. **No fusionar ni marcar `DONE`.** Texto visible en `site-content.ts`, sin afirmaciones comerciales inventadas. **Lee `AGENTS.md` y la documentación local de Next antes de escribir código.**

## Notas de entrega

Rama desde `main` actualizado (sin encadenar; no depende de F4-02 ni F4-03).

**Qué se hizo**

- **`/admin/usuarios`** (solo ADMIN, `requireAdmin()` en la página y en cada acción): tabla paginada de 20 con búsqueda parametrizada por nombre o correo (Prisma, sin SQL crudo), rol, estado, fecha de alta y **documento enmascarado** (últimos 3 caracteres); nunca se consulta ni se muestra el hash. La fila propia no ofrece desactivar ni restablecer.
- **Acciones** (`usuarios/actions.ts`; el actor sale SIEMPRE de la sesión/BD y el usuario afectado llega enlazado desde la fila y se valida como entero; del formulario solo se lee el rol, contra una lista cerrada): `setActiveAction`, `setRoleAction`, `resetPasswordAction`. Auditoría con `logAdminEvent` y los nombres pedidos: `user_deactivated` (y `user_activated`), `user_role_changed` (con el rol nuevo) y `user_password_reset`, sin la contraseña ni el hash.
- **Restablecer contraseña:** `generateTemporaryPassword` (`crypto.randomInt`, 16 caracteres sin ambiguos 0/O/1/l/I, con letra y dígito garantizados: cumple la política de F2-02, comprobado con la misma regla en 2000 muestras); se guarda con bcrypt coste 12 y se devuelve **solo en el estado del componente** (no en la URL, ni en logs, ni en claro en la BD); recargar la página la borra. Mensaje que pide comunicarla por un canal seguro y cambiarla en «Mi cuenta». Limitador de F2-04: 10 por hora por administrador.
- **Salvaguardas en la transacción** (`src/server/admin/users.ts`): una sola sentencia `SELECT … FOR UPDATE` bloquea, en orden de id, a **todos los ADMIN y al usuario afectado**, así dos administradores que se desactivan o degradan mutuamente a la vez quedan en fila y el segundo ve el cambio del primero. Reglas: no auto-desactivarse, no quitarse el rol ADMIN a sí mismo, no restablecer la propia clave desde aquí, y no dejar el sistema sin un ADMIN activo (`last_admin`). Las reservas activas no se cancelan: al desactivar se avisa con un enlace a `/admin/reservas?q=<correo>`.
- **Textos** en `site-content.ts` (`adminUsers`); README con la sección de usuarios.

**Tests (+ 41):** generador de contraseña (política, sin ambiguos, unicidad, generador degenerado); limitador de restablecimientos; acciones con dependencias simuladas (`actions.test.ts`): guarda solo el hash bcrypt de coste 12, **la contraseña temporal y su hash no aparecen en ningún log** (se espían `console.log|info|warn|error|debug`), `requireAdmin` primero, 10 por hora, id inválido, actor de la sesión y `actorId` del formulario ignorado, rol fuera de lista rechazado, eventos escritos; servicio con la BD (`users.db.test.ts`, 12): búsqueda, enmascarado sin hash, inyección, desactivar/activar con conteo de reservas activas (que **no** se cancelan), desactivado no inicia sesión (`verifyCredentials`), cambio de rol, auto-desactivación y auto-degradación prohibidas, **el único ADMIN no se desactiva ni se degrada**, con otro ADMIN sí, y **dos carreras** (desactivarse mutuamente / degradarse mutuamente → exactamente una efectiva y la otra `last_admin`, siempre queda uno), y la temporal sirve mientras la anterior deja de servir. **7 e2e** (`e2e/admin-usuarios.spec.ts`): restablecer (se muestra una vez, entra con la temporal, no con la anterior), desactivar (la sesión abierta pierde el acceso, no puede iniciar sesión, reactivar lo restaura), cambio de rol (entra al panel tras reingresar y sigue sin Usuarios), la fila propia sin acciones y sin poder quitarse el rol, búsqueda con documento enmascarado e inyección, **autorización** (ASESOR y CLIENTE 404 reales, anónimo a login, sin enlace en el menú del ASESOR) y 360 px. `pnpm check` **341** pruebas (3 ejecuciones seguidas), `pnpm test:e2e` **38** (3 ejecuciones), `pnpm build` en verde.

**Para revisar**

1. **Cambio de rol y JWT:** el rol vive en el token; el cambio se ve cuando la persona vuelve a iniciar sesión (el proxy decide con el JWT). Las páginas del panel sí confirman el rol vigente en la BD (`requireStaff/requireAdmin`), así que una **degradación** surte efecto de inmediato en las páginas aunque el proxy aún deje pasar. Documentado en el README.
2. **Pruebas con la BD:** `users.db.test.ts` desactiva temporalmente al ADMIN del seed para probar las carreras y lo **restaura siempre** (`afterEach`, `afterAll` y `beforeAll`); si el proceso se interrumpe a mitad, `pnpm db:seed` lo deja de nuevo activo. La prueba del «único ADMIN» exige que el seed sea el único ADMIN activo.
3. **Accesibilidad a 360 px:** una etiqueta `sr-only` (posición absoluta) dentro de la tabla ensanchaba la página; el contenedor de la tabla es ahora `relative` para contenerla.
4. `maskDocument` se define aquí (`src/server/admin/users.ts`) y también en F4-02 (`reservations.ts`) por no encadenar ramas; al fusionar ambas conviene extraerla a un módulo común.
5. Para «Desactivar» no se pide confirmación adicional (es reversible con «Activar»); restablecer sí requiere abrir el desplegable y confirmar.

**Cómo verificar**: `pnpm db:seed && pnpm check && pnpm build && pnpm test:e2e`; manualmente, con el administrador del seed (`admin@jdsvehiculos.com`), restablecer la clave del cliente demo, entrar con la temporal y restaurar con `pnpm db:seed`.
