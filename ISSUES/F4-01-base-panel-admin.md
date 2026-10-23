# F4-01: Base del panel del concesionario (/admin)

- **Estado:** REVIEW
- **Fase:** 4
- **Depende de:** F3-05 (DONE)
- **Prioridad:** Alta (bloquea el resto de la Fase 4)

## Contexto

El proxy (F2-04) ya protege `/admin/**` (anónimo → login; CLIENTE → 404) pero no existen páginas. Este issue crea el armazón del panel que usarán los demás. Roles (`docs/DOCUMENTACION.md`): `ADMIN` y `ASESOR`.

**Decisión del orquestador por delegación del propietario (demo; confirmar antes de producción):** `ASESOR` gestiona reservas, ventas e inventario; solo `ADMIN` gestiona usuarios y la configuración del concesionario.

**Requisitos de seguridad comunes a toda la Fase 4:** (1) cada página y cada Server Action llama a `requireRole(...)` (además del proxy); el rol sale de la sesión/BD, nunca del formulario; (2) las acciones sensibles usan `getFreshUser()` (el JWT no se revoca); (3) listas explícitas de campos editables (nada de pasar el cuerpo del formulario a Prisma); (4) validación con Zod en servidor; (5) cada cambio relevante escribe un evento de auditoría de una línea JSON (quién, qué, id afectado; sin datos personales ni secretos); (6) los textos y avisos nunca revelan si un registro ajeno existe.

## Alcance

1. Grupo de rutas `(admin)` con layout propio (no usa el header público): barra lateral/menú accesible con Resumen, Reservas, Ventas, Vehículos, Usuarios y Configuración (los dos últimos solo visibles para `ADMIN`), enlace "Ver sitio", nombre del usuario y cerrar sesión. `noindex` en todo el panel, sin scroll horizontal a 360 px.
2. Helper `requireStaff()` (ADMIN o ASESOR) y `requireAdmin()` en `src/server/auth/`, sobre `requireRole()` de F2-01, con tests; un rol insuficiente responde `notFound()`.
3. `/admin` (Resumen) con **contadores reales** de la BD: vehículos por disponibilidad, reservas activas y por vencer en 24 h, ventas del mes, usuarios activos (este último solo ADMIN). Sin gráficos inventados.
4. Activar `showAdminPanelLink` en `site-content.ts` (el menú de usuario ya lo soporta) y probar que solo ADMIN/ASESOR ven "Panel del concesionario".
5. Quitar el `test.fixme` de las variantes de ruta de `/admin` en `e2e/auth.spec.ts` y hacer que pase (ninguna variante da contenido a un CLIENTE o anónimo). Añadir una prueba e2e: ASESOR entra al Resumen, CLIENTE recibe 404, anónimo va a login.
6. Utilidad de auditoría `logAdminEvent` (línea JSON, canal `admin`) para que la usen los demás issues.
7. Tests unitarios de los helpers y de los contadores; `README`: sección "Panel".

## Fuera de alcance

Gestión de reservas, ventas, inventario, usuarios y configuración (issues siguientes).

## Criterios de aceptación

- [x] Anónimo → `/login?next=/admin`; CLIENTE → 404; ASESOR y ADMIN ven el Resumen; ASESOR no ve ni abre Usuarios ni Configuración (404).
- [x] Los contadores coinciden con la BD (comprobado con filas temporales).
- [x] `pnpm check`, `pnpm build` y `pnpm test:e2e` pasan en local; CI: ver el PR.

## Recordatorio de proceso

Rama `issue/<ID>-<slug>` **creada desde `main` actualizado** (`git checkout main && git pull`), nunca encadenada sobre otra rama sin fusionar; si dependes de un issue que aún no está en `main`, espera. PR al terminar y estado `REVIEW`. **No fusionar ni marcar `DONE`.** Texto visible en `site-content.ts`, sin afirmaciones comerciales inventadas. **Lee `AGENTS.md` y la documentación local de Next antes de escribir código.**

## Notas de entrega

**Rama** `issue/F4-01-base-panel-admin`, creada desde `main` actualizado (sin encadenar sobre F4-09).

**Qué se hizo**

- **Armazón** (`src/app/(admin)/layout.tsx`, `AdminFrame`, `AdminNav`): barra lateral en escritorio y pestañas con scroll interno en móvil; Resumen, Reservas, Ventas, Vehículos y, **solo para `ADMIN`**, Usuarios y Configuración; «Ver sitio», nombre y rol del usuario y «Cerrar sesión» (formulario POST). `noindex` en todo el panel; sin scroll horizontal a 360 px (comprobado).
- **Helpers** `requireStaff()` y `requireAdmin()` (`src/server/auth/staff.ts`), sobre `requireRole()`. Decisión a revisar: además de comprobar el rol del JWT, **confirman en la BD** que la cuenta siga activa y que el rol sea el vigente (como piden los requisitos comunes (1)–(2); el JWT dura 7 días y no se revoca). Rol insuficiente o cuenta desactivada → `notFound()`; sin sesión → login con `next`.
- **Resumen** (`/admin`): contadores reales de `src/server/admin/dashboard.ts`: vehículos por disponibilidad, reservas activas, reservas `PENDIENTE_CONTACTO` por vencer en 24 h (no cuenta las ya vencidas), ventas del mes y total vendido (mes calendario de Bogotá, UTC-5) y usuarios activos (solo `ADMIN`; el `ASESOR` ni lo calcula ni lo ve). Sin gráficos.
- **Marcadores de sección** `/admin/reservas|ventas|vehiculos` (`requireStaff`) y `/admin/usuarios|configuracion` (`requireAdmin`) con el texto «Esta sección estará disponible próximamente.»; los issues F4-02…F4-07 los reemplazan. Existen para que el menú no dé 404 y para poder probar el acceso por rol de verdad.
- **`logAdminEvent`** (`src/server/admin/audit.ts`): línea JSON del canal `admin` (`actorId`, `action`, `entity`, `entityId`, `detail` acotado a 200).
- `showAdminPanelLink = true`: «Panel del concesionario» solo en el menú de `ADMIN` y `ASESOR` (probado en unitario y e2e).
- **Proxy:** `/admin/usuarios` y `/admin/configuracion` devuelven **404 real** a un `ASESOR` (decisión `notFound` en `decideAccess`, con test); la página lo vuelve a comprobar con la BD.
- **e2e:** se quitó el `test.fixme` de `auth.spec.ts` y se sustituyó por pruebas reales en `e2e/admin.spec.ts` (11): anónimo → `/login?next=%2Fadmin` y vuelta tras entrar; ASESOR ve el Resumen y las 4 secciones, no Usuarios/Configuración (404); ADMIN los ve; CLIENTE recibe 404 y no ve el panel en su menú; menú del ASESOR con enlace al panel; **usuario desactivado con sesión abierta pierde el acceso**; cierre de sesión; las 5 variantes de ruta (`/%61dmin/x`, `/admin%2fx`, `/ADMIN/x`, `/admin//x`, `/admin/../admin/x`) para anónimo (acaban en login o 404) y CLIENTE (acaban en 404) sin contenido del panel; 360 px. Usuarios temporales `@e2e-test.local`, borrados aunque falle (y barridos por `global-setup`).
- README: sección «Panel» con la tabla de acceso y las **reglas para quienes añadan páginas o acciones** (require*, rol de la sesión/BD, campos explícitos, Zod, `logAdminEvent`, mensajes que no revelan registros ajenos); tabla de rutas actualizada.

**Tests nuevos (19 unitarios + 11 e2e):** helpers de rol (CLIENTE sin tocar la BD, ADMIN/ASESOR, token ADMIN con cuenta desactivada o degradada en la BD, usuario eliminado, ASESOR en `requireAdmin`), auditoría (una línea, solo campos esperados, detalle acotado), contadores contra la BD con filas temporales 9501+ (cambio exacto por disponibilidad, activas, por vencer, venta de este mes vs. mes anterior, usuario inactivo; ASESOR sin contador de usuarios), límites del mes (04:59 UTC del 1 de noviembre aún es octubre) y `decideAccess`. Total: `pnpm check` **313** pruebas; `pnpm test:e2e` **31 pasan** (3 ejecuciones seguidas); `pnpm build` en verde.

**Para revisar**

1. **Estado HTTP 200 con contenido «no encontrado»** cuando la denegación ocurre dentro de la página (cuenta desactivada con token vigente, o rol degradado en la BD): el panel va en streaming y la cabecera ya se envió. No se muestra nada del panel (probado). Los casos que el proxy puede decidir con el JWT (CLIENTE, ASESOR en usuarios/configuración, anónimo) sí dan 404/redirect reales.
2. **Variante `/admin//x`:** Next la normaliza con un 308 a `/admin/x`, que el proxy redirige a login (anónimo) o 404 (CLIENTE); el e2e sigue la cadena.
3. **Marcadores de sección:** son páginas mínimas a propósito; si F4-02…F4-07 se desarrollan en paralelo, cada una tocará solo «su» `page.tsx`.
4. El layout muestra un esqueleto mientras `requireStaff` resuelve; sin JavaScript el panel no se pinta (mismo comportamiento que el resto de páginas dinámicas, conocido desde F1).
5. Persiste en el log del servidor de producción el aviso `crypto.getRandomValues()` de Auth.js ya reportado en F2-06.

**Cómo verificar**: `pnpm db:seed && pnpm check && pnpm build && pnpm test:e2e`; manualmente, poner temporalmente `rol_id = 2` al cliente demo (`UPDATE usuarios SET rol_id=2 WHERE id=2`), entrar a `/admin` y restaurar con `rol_id = 1`.
