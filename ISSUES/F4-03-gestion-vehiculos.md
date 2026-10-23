# F4-03: Gestión de vehículos, marcas y modelos

- **Estado:** TODO
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

- [ ] Crear un vehículo USADO sin placa se rechaza; NUEVO sin placa se acepta; la placa duplicada da un error de campo.
- [ ] Un vehículo creado aparece en `/catalogo` de inmediato y uno ocultado desaparece.
- [ ] No se puede poner `RESERVADO` a mano ni editar un vehículo con reserva activa en sus campos críticos.
- [ ] `pnpm check`, `pnpm build` y `pnpm test:e2e` pasan; CI en verde.

## Recordatorio de proceso

Rama `issue/<ID>-<slug>` **creada desde `main` actualizado** (`git checkout main && git pull`), nunca encadenada sobre otra rama sin fusionar; si dependes de un issue que aún no está en `main`, espera. PR al terminar y estado `REVIEW`. **No fusionar ni marcar `DONE`.** Texto visible en `site-content.ts`, sin afirmaciones comerciales inventadas. **Lee `AGENTS.md` y la documentación local de Next antes de escribir código.**
