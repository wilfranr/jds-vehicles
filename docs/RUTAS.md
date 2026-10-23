# Mapa de rutas y acciones

<!-- Generado por `pnpm rutas` (scripts/generar-rutas.ts). NO editar a mano: un test compara este archivo con el código. -->

Toda ruta o acción nueva obliga a regenerar este archivo (`pnpm rutas`) y a revisar la columna de acceso. Además del
proxy (`src/proxy.ts`, que decide con el JWT), cada página y cada acción comprueba el rol en la base de datos.

## Páginas y rutas HTTP

| URL | Tipo | Acceso |
| --- | --- | --- |
| `/` | Página | Público |
| `/_design` | Página | Público |
| `/admin` | Página | ADMIN, ASESOR |
| `/admin/configuracion` | Página | ADMIN |
| `/admin/reservas` | Página | ADMIN, ASESOR |
| `/admin/reservas/[codigo]` | Página | ADMIN, ASESOR |
| `/admin/usuarios` | Página | ADMIN |
| `/admin/vehiculos` | Página | ADMIN, ASESOR |
| `/admin/vehiculos/[id]` | Página | ADMIN, ASESOR |
| `/admin/vehiculos/[id]/fotos` | Ruta POST | ADMIN, ASESOR |
| `/admin/vehiculos/marcas` | Página | ADMIN, ASESOR |
| `/admin/vehiculos/nuevo` | Página | ADMIN, ASESOR |
| `/admin/ventas` | Página | ADMIN, ASESOR |
| `/admin/ventas/[recibo]` | Página | ADMIN, ASESOR |
| `/api/auth/[...nextauth]` | Ruta GET/POST | Auth.js |
| `/api/health` | Ruta GET | Público |
| `/api/health/live` | Ruta GET | Público |
| `/catalogo` | Página | Público |
| `/como-funciona` | Página | Público |
| `/contacto` | Página | Público |
| `/login` | Página | Anónimo (con sesión redirige) |
| `/media/[...ruta]` | Ruta GET | Público |
| `/mi-cuenta` | Página | Cualquier sesión |
| `/mi-cuenta/reservas` | Página | Cualquier sesión |
| `/mi-cuenta/reservas/[codigo]` | Página | Cualquier sesión |
| `/mi-cuenta/seguridad` | Página | Cualquier sesión |
| `/privacidad` | Página | Público |
| `/proximamente` | Página | Público |
| `/registro` | Página | Anónimo (con sesión redirige) |
| `/terminos` | Página | Público |
| `/vehiculos/[id]` | Página | Público |

## Server Actions

| Archivo | Acción | Acceso |
| --- | --- | --- |
| `app/(account)/mi-cuenta/actions.ts` | `updateProfileAction` | Cualquier sesión |
| `app/(account)/mi-cuenta/seguridad/actions.ts` | `changePasswordAction` | Cualquier sesión |
| `app/(admin)/admin/configuracion/actions.ts` | `updateConfigAction` | ADMIN |
| `app/(admin)/admin/reservas/[codigo]/venta-actions.ts` | `registerSaleAction` | ADMIN, ASESOR |
| `app/(admin)/admin/reservas/actions.ts` | `cancelReservationAction` | ADMIN, ASESOR |
| `app/(admin)/admin/reservas/actions.ts` | `saveNotesAction` | ADMIN, ASESOR |
| `app/(admin)/admin/reservas/actions.ts` | `startNegotiationAction` | ADMIN, ASESOR |
| `app/(admin)/admin/usuarios/actions.ts` | `resetPasswordAction` | ADMIN |
| `app/(admin)/admin/usuarios/actions.ts` | `setActiveAction` | ADMIN |
| `app/(admin)/admin/usuarios/actions.ts` | `setRoleAction` | ADMIN |
| `app/(admin)/admin/vehiculos/[id]/fotos-actions.ts` | `deletePhotoAction` | ADMIN, ASESOR |
| `app/(admin)/admin/vehiculos/[id]/fotos-actions.ts` | `movePhotoAction` | ADMIN, ASESOR |
| `app/(admin)/admin/vehiculos/[id]/fotos-actions.ts` | `setPrincipalAction` | ADMIN, ASESOR |
| `app/(admin)/admin/vehiculos/actions.ts` | `createBrandAction` | ADMIN, ASESOR |
| `app/(admin)/admin/vehiculos/actions.ts` | `createModelAction` | ADMIN, ASESOR |
| `app/(admin)/admin/vehiculos/actions.ts` | `createVehicleAction` | ADMIN, ASESOR |
| `app/(admin)/admin/vehiculos/actions.ts` | `renameBrandAction` | ADMIN, ASESOR |
| `app/(admin)/admin/vehiculos/actions.ts` | `renameModelAction` | ADMIN, ASESOR |
| `app/(admin)/admin/vehiculos/actions.ts` | `setBrandActiveAction` | ADMIN, ASESOR |
| `app/(admin)/admin/vehiculos/actions.ts` | `setModelActiveAction` | ADMIN, ASESOR |
| `app/(admin)/admin/vehiculos/actions.ts` | `setVisibilityAction` | ADMIN, ASESOR |
| `app/(admin)/admin/vehiculos/actions.ts` | `updateVehicleAction` | ADMIN, ASESOR |
| `app/(auth)/login/actions.ts` | `loginAction` | Público |
| `app/(auth)/registro/actions.ts` | `registerAction` | Público |
| `app/(public)/vehiculos/[id]/actions.ts` | `reserveVehicleAction` | Cualquier sesión |
| `server/auth/logout-action.ts` | `logoutAction` | Público |
