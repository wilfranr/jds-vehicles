# F4-03: Gestión de vehículos, marcas y modelos

- **Estado:** REVIEW
- **Fase:** 4
- **Depende de:** F4-01
- **Prioridad:** Alta

## Contexto

Hoy el inventario solo existe por el seed. Reglas de `docs/DOCUMENTACION.md` §1.1: `NUEVO` no exige placa y su kilometraje es 0; `USADO` exige placa y kilometraje; un `VENDIDO` se oculta (`visible_catalogo = false`). Las fotos son F4-04.

**Requisitos de seguridad comunes a toda la Fase 4:** (1) cada página y cada Server Action llama a `requireRole(...)` (además del proxy); el rol sale de la sesión/BD, nunca del formulario; (2) las acciones sensibles usan `getFreshUser()` (el JWT no se revoca); (3) listas explícitas de campos editables (nada de pasar el cuerpo del formulario a Prisma); (4) validación con Zod en servidor; (5) cada cambio relevante escribe un evento de auditoría de una línea JSON (quién, qué, id afectado; sin datos personales ni secretos); (6) los textos y avisos nunca revelan si un registro ajeno existe.

## Alcance

1. `/admin/vehiculos`: tabla paginada (marca, modelo, año, condición, precio, disponibilidad, visible) con filtros y búsqueda; acciones Editar, Ocultar/Mostrar.
2. Crear y editar (`/admin/vehiculos/nuevo`, `/admin/vehiculos/[id]`) con las reglas de negocio en un **esquema Zod único** compartido y probado: marca/modelo existentes, año razonable, color, condición, **placa obligatoria y normalizada (mayúsculas, sin espacios) para USADO** y vacía o nula para NUEVO si el km es 0, precio > 0 (decimal sin errores de flotante), kilometraje ≥ 0, transmisión, combustible, cilindraje opcional y descripción (límite de longitud, texto plano). Placa **única** entre vehículos no vendidos (error claro, sin 500).
3. Cambio manual de `disponibilidad` solo entre `DISPONIBLE` y `PROXIMAMENTE`. `RESERVADO` y `VENDIDO` los producen los flujos de reserva y venta, no un selector (si el vehículo tiene una reserva activa, el campo se muestra bloqueado con la explicación). No se puede ocultar ni editar la condición de un vehículo con reserva activa o ya vendido.
4. Marcas y modelos: crear y renombrar, activar/desactivar (no borrar si hay vehículos asociados). Nombres únicos (ya existen índices), validación y mensajes claros.
5. Invalidar la caché del catálogo (`catalog-vehicles`) tras cada cambio; el catálogo debe reflejarlo sin esperar.
6. **Tests:** el esquema (todas las reglas, placa duplicada, USADO sin placa, NUEVO con km), las restricciones de disponibilidad, autorización (ASESOR y ADMIN sí; CLIENTE 404), y que la edición ignora campos extra enviados en el formulario (`id`, `disponibilidad` cuando está bloqueada, `visibleCatalogo`).

## Fuera de alcance

Fotos (F4-04), importación masiva, borrado definitivo de vehículos.

## Criterios de aceptación

- [x] Crear un vehículo USADO sin placa se rechaza; NUEVO sin placa se acepta; la placa duplicada da un error de campo.
- [x] Un vehículo creado aparece en `/catalogo` de inmediato y uno ocultado desaparece.
- [x] No se puede poner `RESERVADO` a mano ni editar un vehículo con reserva activa en sus campos críticos.
- [x] `pnpm check`, `pnpm build` y `pnpm test:e2e` pasan en local; CI: ver el PR.

## Recordatorio de proceso

Rama `issue/<ID>-<slug>` **creada desde `main` actualizado** (`git checkout main && git pull`), nunca encadenada sobre otra rama sin fusionar; si dependes de un issue que aún no está en `main`, espera. PR al terminar y estado `REVIEW`. **No fusionar ni marcar `DONE`.** Texto visible en `site-content.ts`, sin afirmaciones comerciales inventadas. **Lee `AGENTS.md` y la documentación local de Next antes de escribir código.**

## Notas de entrega

Rama desde `main` actualizado (sin encadenar).

**Qué se hizo**

- **Esquema único** `src/lib/validation/vehicle.ts` (Zod, mensajes inyectados desde `site-content.ts`): modelo (id entero), año de 1950 al siguiente al actual, color 2–50, condición, **placa** normalizada (mayúsculas, sin espacios ni guiones, 5–10 alfanuméricos) **obligatoria para USADO** y **no permitida para NUEVO**, NUEVO con 0 km, **precio** como texto decimal exacto (solo dígitos y hasta 2 decimales con punto, > 0, tope 9 999 999 999,99; nunca `Number` para guardar), kilometraje 0–9 999 999, transmisión, combustible, cilindraje opcional 50–10 000, descripción de texto plano ≤ 2000 sin caracteres de control, y disponibilidad solo `DISPONIBLE`/`PROXIMAMENTE`.
- **Servicios** (`src/server/admin/vehicles.ts`, `catalog-admin.ts`): listado paginado de 20 con búsqueda (marca, modelo, color, placa) y filtros (condición, disponibilidad, visibilidad), crear, editar, mostrar/ocultar, y marcas/modelos (crear, renombrar, activar/desactivar; **no hay borrado**, tal como indica el issue). Nombres duplicados → error de campo, no 500.
- **Reglas de bloqueo** (`vehicle-rules.ts`, puras y probadas): `none` (todo editable), `reserved` (reserva activa o estado RESERVADO: solo **precio y descripción**; no se puede ocultar) y `sold` (solo lectura; ni mostrar ni ocultar). El bloqueo se calcula **dentro de la transacción con la fila bloqueada (`FOR UPDATE`)**, así una reserva simultánea no se cuela. Con el vehículo bloqueado, los campos críticos se toman de la BD y lo que llegue del formulario para ellos se ignora; Prisma recibe una lista explícita de campos (`editableData`).
- **Placa única entre no vendidos:** no hay restricción en la BD (un vendido conserva su placa), así que se comprueba en la transacción; dos altas simultáneas con la misma placa quedan serializadas con un bloqueo de fila (`FOR UPDATE` sobre una fila fija de `roles`, que se mantiene hasta el `COMMIT`; el bloqueo con nombre de MySQL `GET_LOCK` se probó primero y **no basta** porque se libera antes de confirmar). Probado con 3 altas concurrentes: 1 creada y 2 `plate_duplicate`.
- **Páginas** `/admin/vehiculos`, `/nuevo`, `/[id]` y `/marcas`, todas con `requireStaff()` (ADMIN y ASESOR); cada Server Action vuelve a llamar a `requireStaff()` (que confirma rol y cuenta activa en la BD). El id de edición va enlazado desde la página (`bind`), nunca en el formulario. Accesibles: `label` + `aria-describedby` + `aria-invalid`, tabla con `scope`, botones con nombre accesible por vehículo, sin scroll horizontal a 360 px (la tabla desplaza dentro de su contenedor).
- **Caché:** cada alta, edición, visibilidad y cambio de marca/modelo llama a `invalidateCatalogFromAction()` (`updateTag`); el catálogo lo refleja al instante (probado en e2e). **Auditoría:** `logAdminEvent` en cada cambio (`vehicle.created|updated|hidden|shown`, `brand.*`, `model.*`; en `updated` solo los nombres de los campos, no los valores).

**Tests (+ 77):** esquema (38 casos: cada regla, USADO sin placa, NUEVO con km/placa, precio exacto, año máximo, campos extra no pasan), reglas de bloqueo (`id`, `visibleCatalogo`, placa, condición y disponibilidad enviados en el cuerpo se ignoran), servicios con la BD (`*.db.test.ts`, 15: crear, NUEVO sin placa, placa duplicada y reutilizable si el otro está VENDIDO, carrera de placa, modelo inactivo/inexistente, edición con reserva activa, vendido, visibilidad, filtros, paginación, marcas/modelos duplicados y `not_found`) y **7 e2e** (`e2e/admin-vehiculos.spec.ts`): ASESOR crea un USADO y aparece en `/catalogo` al instante, ocultar/mostrar; USADO sin placa rechazado, NUEVO aceptado, placa duplicada con error de campo; reserva activa (campos críticos deshabilitados, solo el precio cambia, sin botón de ocultar); ADMIN crea marca y modelo y se ofrecen al crear un vehículo, con duplicado; **CLIENTE recibe 404 y el anónimo va a login en las 4 rutas**; ids inválidos; 360 px. Los datos temporales de e2e llevan prefijos (`E2E-RESERVAS-`, `E2E-MARCA-`) y `global-setup.ts` los barre (ahora también marcas y modelos). Total: `pnpm check` **375** pruebas, `pnpm test:e2e` **38** (37 + 1 de 360 px, repetido 3 veces sin fallos), `pnpm build` verde.

**Para revisar**

1. **Estado HTTP 200 con «no encontrado»** en `/admin/vehiculos/<id inexistente>` (página en streaming, como en F4-01); el contenido no revela nada.
2. **Desactivar una marca o modelo** solo deja de ofrecerlos al crear/editar vehículos; los vehículos existentes siguen en el catálogo (no hay borrado). Conservar un modelo ya inactivo al editar un vehículo es válido.
3. La placa se valida como 5–10 alfanuméricos (placas colombianas son de 6); el criterio es amplio a propósito (motos, extranjeras).
4. `RESERVADO` sin reserva activa (estado huérfano) también se trata como bloqueado; solo el flujo de reservas/expiración lo libera.
5. Las fotos son F4-04: el formulario no las incluye.

**Cómo verificar**: `pnpm db:seed && pnpm check && pnpm build && pnpm test:e2e`; en `/admin/vehiculos` (con un ASESOR o ADMIN) crear un USADO y buscarlo en `/catalogo?color=<color>`.
