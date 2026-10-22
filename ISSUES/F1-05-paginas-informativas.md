# F1-05: Próximamente disponibles, Cómo funciona y Contacto

- **Estado:** DONE
- **Fase:** 1
- **Depende de:** F1-01, F1-02, F1-03
- **Prioridad:** Media

## Contexto

Tres páginas del menú principal. Los textos son provisionales; deben salir de `src/lib/site-content.ts` (creado en F1-01) para poder editarlos fácilmente. **Lee `AGENTS.md` y la documentación local de Next.**

## Alcance

1. `/proximamente`: lista los vehículos con `disponibilidad = PROXIMAMENTE` reutilizando `listVehicles` y `VehicleCard` (con el badge violeta "Próximamente"). Orden por más reciente. Estado vacío amable ("Pronto tendremos novedades. Escríbenos por WhatsApp y te avisamos") con CTA a WhatsApp.
2. `/como-funciona`: explica el flujo real del negocio de `docs/DOCUMENTACION.md` §1.3 y §1.4 en pasos numerados:
   1. Explora el catálogo y elige tu vehículo.
   2. Crea tu cuenta o inicia sesión.
   3. Reserva: el vehículo queda apartado y recibes un código único.
   4. Continúa por WhatsApp con un asesor.
   5. El cierre del negocio (pago, traspaso) se coordina directamente con el concesionario, fuera de la plataforma.
   - Incluir preguntas frecuentes en acordeón accesible (`<details>`): qué significa reservar, si la reserva tiene costo (**no afirmar nada que no esté en la documentación**; dejar `TODO(owner)` si falta el dato), qué pasa si cancelo, cuánto dura la reserva.
   - CTA a `/catalogo`.
3. `/contacto`: datos de contacto (WhatsApp y Instagram desde `getDealerConfig()`, de F1-01), botón de WhatsApp con mensaje genérico, y espacio para dirección/horario/mapa como `TODO(owner)` ocultos mientras no haya datos (no mostrar "undefined" ni campos vacíos).
   - **Sin formulario de contacto** en esta fase (evita almacenar datos y spam). El canal es WhatsApp.
4. Las tres páginas con `metadata` propia (título y descripción en español) y enlaces correctos desde el header y el footer.

## Fuera de alcance

Formulario de contacto, mapa embebido, blog, página de preguntas frecuentes separada.

## Criterios de aceptación

- [x] `/proximamente` muestra el Hilux del seed; si se cambia su disponibilidad a `DISPONIBLE`, deja de aparecer ahí.
- [x] Los textos editables viven en `site-content.ts`.
- [x] No hay afirmaciones de negocio inventadas fuera de las provisionales ya existentes; lo desconocido está marcado con `TODO(owner)` en el código y no se muestra en pantalla.
- [x] Accesibilidad ≥ 95 y sin scroll horizontal a 360 px.
- [x] `pnpm check` y `pnpm build` pasan.

## Verificación

`pnpm dev` y recorrer `/proximamente`, `/como-funciona`, `/contacto` en móvil y escritorio.

## Notas de entrega

- **`/proximamente`**: Creada con Server Components, fallback de streaming `loading.tsx` y consulta `listVehicles({ disponibilidad: PROXIMAMENTE })`. Muestra el Hilux del seed con su badge de preventa y cuenta con estado vacío amable con CTA a WhatsApp en caso de ausencia de unidades por ingresar. Ajustado el texto a "Vehículos que están por ingresar a nuestro inventario" según definición de `PROXIMAMENTE` en `docs/DOCUMENTACION.md`.
- **`/como-funciona`**: Pasos numerados del 01 al 05 explicando el flujo de compra y reserva alineado estrictamente con `docs/DOCUMENTACION.md` (§1.3 y §1.4). Apertura de WhatsApp con código de reserva en el mensaje, cierre fuera de la plataforma con el concesionario y texto descriptivo neutro. Sección de FAQs con acordeón semántico y accesible `<details>`/`<summary>`, confirmando condiciones comerciales directamente con el asesor por WhatsApp.
- **`/contacto`**: Información oficial consumiendo `getDealerConfig()`. Tarjeta de WhatsApp con CTA directo (`wa.me`) y tarjeta de Instagram enlazando al perfil verificado. Texto limitado exclusivamente a la asesoría en compra de vehículos e inventario/reservas. Bloques no definidos (dirección física, horarios y mapa) están marcados con `TODO(owner)` y no se exponen al usuario.
- **Centralización**: Todo el contenido textual y editorial de las 3 páginas vive en `siteContent` dentro de `src/lib/site-content.ts`.
- **Verificación**: `pnpm format`, `pnpm check` (Prettier, ESLint, TypeScript, Vitest 36/36 tests) y `pnpm build` pasan con cero errores. Rutas verificadas con el servidor en producción.
