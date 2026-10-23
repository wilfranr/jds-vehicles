# F4-07: Configuración del concesionario (solo ADMIN)

- **Estado:** DONE
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

- [x] Cambiar el WhatsApp a un número de prueba cambia el botón flotante, el pie y los enlaces de reserva; se restaura al final.
- [x] Un número inválido o una URL de otro dominio se rechazan.
- [x] `pnpm check`, `pnpm build` y `pnpm test:e2e` pasan en local; CI: ver el PR.

## Recordatorio de proceso

Rama `issue/<ID>-<slug>` **creada desde `main` actualizado** (`git checkout main && git pull`), nunca encadenada sobre otra rama sin fusionar; si dependes de un issue que aún no está en `main`, espera. PR al terminar y estado `REVIEW`. **No fusionar ni marcar `DONE`.** Texto visible en `site-content.ts`, sin afirmaciones comerciales inventadas. **Lee `AGENTS.md` y la documentación local de Next antes de escribir código.**

## Notas de entrega

Rama desde `main` actualizado (sin encadenar; no depende de F4-02, F4-03 ni F4-06).

**Qué se hizo**

- **Lista blanca en código** (`src/lib/validation/dealer-config.ts`): `whatsapp_numero` e `instagram_url`, las dos que lee `getDealerConfig()`. `whatsapp_mensaje_plantilla` existe en la BD pero queda **fuera** (plantillas editables están fuera de alcance). Una clave desconocida se rechaza en la acción **y** en el servicio (`saveConfigValue`), de modo que no se pueden crear ni modificar claves arbitrarias.
- **Validación por clave:** WhatsApp con `normalizeColombianMobile` (la de F2-02) → `57XXXXXXXXXX`; Instagram `https` con host exacto `instagram.com` o `www.instagram.com`, sin usuario/clave, sin puerto, sin espacios ni caracteres de control, ≤ 300 caracteres (rechaza `instagram.com.evil.com`, `evilinstagram.com`, `https://instagram.com@evil.com`, `javascript:`, `data:`, `//instagram.com`, subdominios…). Acepta la URL con `xtok`/`utm_source` del seed.
- **`/admin/configuracion`** (`requireAdmin()` en la página y en la acción): por clave se ve el valor vigente (y si es el de respaldo), un campo, una **vista previa del enlace** que se calcula en vivo con la misma lógica que el servidor (`wa.me/<número>?text=…` con enlace «Probar») y una **casilla de confirmación** obligatoria que **el servidor también exige**.
- **Efecto inmediato:** `updateConfigAction` llama a `updateTag('dealer-config')` (la etiqueta de `getDealerConfig()`) y escribe el evento `config_changed` con el valor anterior y el nuevo. Comprobado en e2e: tras guardar, el botón flotante y el header (y el pie y la ficha) usan el nuevo número sin reiniciar.
- La clave llega **enlazada** desde la página y se valida; del formulario solo se leen `valor` y `confirmar` (se ignoran `clave`, `id`…).

**Tests (+ 53):** validación por clave (normalización de WhatsApp, 15+ casos hostiles de Instagram, lista blanca con `__proto__`, `constructor`…), acción con dependencias simuladas (guarda el valor normalizado, invalida `dealer-config`, audita anterior → nuevo, exige `requireAdmin`, clave desconocida, valores inválidos sin guardar ni invalidar, casilla de confirmación exigida en el servidor, campos extra ignorados), servicio con la BD (`dealer-config.db.test.ts`: guarda y devuelve el anterior, clave fuera de la lista no escribe nada; restaura siempre los valores) y **4 e2e** (`e2e/admin-configuracion.spec.ts`, en serie y restaurando los originales **por la propia interfaz**, que también invalida la caché, aunque fallen): vista previa → no se envía sin confirmar → guardar → botón flotante, header, pie y ficha con el nuevo número → restaurado; número inválido y URLs de otros dominios rechazados sin guardar; **autorización** (ASESOR y CLIENTE 404 reales, anónimo a login); 360 px. `pnpm check` **354** pruebas (3 ejecuciones), `pnpm test:e2e` **35** (3 ejecuciones), `pnpm build` en verde. Configuración de la BD verificada tras las pruebas (valores del seed).

**Para revisar**

1. **Número global en pruebas paralelas:** durante unos segundos de `test:e2e` el sitio usa el número de prueba (`573112223344`); las demás pruebas solo comprueban el formato `wa.me/\d+`, no el número, así que no se afectan. El archivo corre en serie para no pisarse a sí mismo.
2. **`whatsappDisplay`** (el número con formato que muestra el pie): sigue saliendo de `site-content.ts` si algún componente lo usa; este issue solo cambia el que lee `getDealerConfig()` (los enlaces). Si el pie mostrara el texto del número, convendría derivarlo del valor guardado (no se tocó para no ampliar el alcance).
3. La vista previa del cliente repite la normalización del servidor (mismas funciones puras): el servidor sigue siendo la autoridad.
4. Si la tabla aún no tiene una clave (instalación nueva sin seed), se usa el valor de respaldo y el primer guardado la crea.

**Cómo verificar**: `pnpm db:seed && pnpm check && pnpm build && pnpm test:e2e`; manualmente, como ADMIN, cambiar el WhatsApp a un número de prueba, ver el botón flotante y restaurar el original (o `pnpm db:seed`).
