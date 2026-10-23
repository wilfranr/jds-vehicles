# F4-07: Configuración del concesionario (solo ADMIN)

- **Estado:** TODO
- **Fase:** 4
- **Depende de:** F4-01
- **Prioridad:** Media

## Contexto

La tabla `configuracion_concesionario` (clave/valor) guarda el número de WhatsApp oficial y otros parámetros que hoy se leen con `getDealerConfig()`. Un error en el número rompe todos los enlaces de WhatsApp del sitio.

**Requisitos de seguridad comunes a toda la Fase 4:** (1) cada página y cada Server Action llama a `requireRole(...)` (además del proxy); el rol sale de la sesión/BD, nunca del formulario; (2) las acciones sensibles usan `getFreshUser()` (el JWT no se revoca); (3) listas explícitas de campos editables (nada de pasar el cuerpo del formulario a Prisma); (4) validación con Zod en servidor; (5) cada cambio relevante escribe un evento de auditoría de una línea JSON (quién, qué, id afectado; sin datos personales ni secretos); (6) los textos y avisos nunca revelan si un registro ajeno existe.

## Alcance

1. `/admin/configuracion` (**solo ADMIN**): editar únicamente las claves conocidas (lista blanca en código: número de WhatsApp, URL de Instagram y las que ya use `getDealerConfig()`); no se pueden crear claves arbitrarias.
2. Validación estricta por clave: WhatsApp = móvil colombiano normalizado a `57XXXXXXXXXX` (misma función de F2-02); Instagram = URL `https` del dominio `instagram.com`. Mostrar una **vista previa** del enlace `wa.me` resultante antes de guardar y pedir confirmación.
3. Tras guardar, invalidar lo que dependa de la configuración (header, pie, botón flotante y enlaces de reserva); comprobar que un cambio se refleja en el sitio sin reiniciar.
4. Auditoría con el valor anterior y el nuevo (son datos del negocio, no personales).
5. **Tests:** validación por clave, lista blanca (clave desconocida rechazada), invalidación de caché, autorización (ASESOR y CLIENTE 404).

## Fuera de alcance

Plantillas de mensaje editables, horarios, dirección y mapa (siguen ocultos hasta que existan datos del propietario).

## Criterios de aceptación

- [ ] Cambiar el WhatsApp a un número de prueba cambia el botón flotante, el pie y los enlaces de reserva; se restaura al final.
- [ ] Un número inválido o una URL de otro dominio se rechazan.
- [ ] `pnpm check`, `pnpm build` y `pnpm test:e2e` pasan; CI en verde.

## Recordatorio de proceso

Rama `issue/<ID>-<slug>` **creada desde `main` actualizado** (`git checkout main && git pull`), nunca encadenada sobre otra rama sin fusionar; si dependes de un issue que aún no está en `main`, espera. PR al terminar y estado `REVIEW`. **No fusionar ni marcar `DONE`.** Texto visible en `site-content.ts`, sin afirmaciones comerciales inventadas. **Lee `AGENTS.md` y la documentación local de Next antes de escribir código.**
