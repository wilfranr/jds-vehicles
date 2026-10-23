# F4-01: Base del panel del concesionario (/admin)

- **Estado:** TODO
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

- [ ] Anónimo → `/login?next=/admin`; CLIENTE → 404; ASESOR y ADMIN ven el Resumen; ASESOR no ve ni abre Usuarios ni Configuración (404).
- [ ] Los contadores coinciden con la BD (comprobado con filas temporales).
- [ ] `pnpm check`, `pnpm build` y `pnpm test:e2e` pasan; CI en verde.

## Recordatorio de proceso

Rama `issue/<ID>-<slug>` **creada desde `main` actualizado** (`git checkout main && git pull`), nunca encadenada sobre otra rama sin fusionar; si dependes de un issue que aún no está en `main`, espera. PR al terminar y estado `REVIEW`. **No fusionar ni marcar `DONE`.** Texto visible en `site-content.ts`, sin afirmaciones comerciales inventadas. **Lee `AGENTS.md` y la documentación local de Next antes de escribir código.**
