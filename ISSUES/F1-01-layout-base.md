# F1-01: Layout base: header, footer y botón flotante de WhatsApp

- **Estado:** DONE
- **Fase:** 1
- **Depende de:** F0-08
- **Prioridad:** Alta

## Contexto

Todas las páginas públicas comparten cabecera, pie y el acceso a WhatsApp. Referencia visual: `docs/prototype/code.html` (header) y `docs/DESIGN.md` (botón WhatsApp, glassmorphism solo en cabecera sticky). **Antes de escribir código lee `AGENTS.md` y la documentación de `node_modules/next/dist/docs/`**: esta versión de Next tiene cambios incompatibles (Cache Components activado).

## Alcance

1. Layout del grupo `src/app/(public)/layout.tsx` con `SiteHeader`, `SiteFooter` y `WhatsAppFab`. La portada provisional `src/app/page.tsx` se mueve al grupo `(public)` (la portada real se hace en F1-03).
2. **`src/lib/site-content.ts`**: archivo único con los textos y cifras de marca que hoy son de ejemplo, para poder cambiarlos sin tocar componentes. Valores iniciales tomados del prototipo (los confirmó el propietario como provisionales):
   - `trustMetrics`: `{ value: '42', label: 'Vehículos Curados' }`, `{ '100%', 'Garantía Mecánica' }`, `{ '48h', 'Entrega Inmediata' }`
   - `heroTitle`: "Encuentra tu próximo auto nuevo o seminuevo certificado"
   - `heroSubtitle`: "Inspección pericial de 120 puntos, historial de propiedad verificado y entrega de llave en mano garantizada."
   - nombre del negocio, eslogan y redes.
   - Comentario `// TODO(owner): cifras provisionales, confirmar con el negocio` sobre las métricas.
3. **`SiteHeader`** (componente de servidor salvo la parte interactiva): logo `public/logo.jpg` + nombre, navegación (Catálogo, Próximamente disponibles, Cómo funciona, Contacto), enlace a Instagram, botón de WhatsApp en forma de pastilla (`#25D366`). Sticky, con `backdrop-blur` según DESIGN.md. Menú hamburguesa accesible en móvil (`<xl`), con foco gestionado y cierre con Esc.
   - **No** replicar del prototipo el perfil falso "Carlos Mendoza", ni la campana de notificaciones, ni el enlace "Panel Concesionario".
   - Dejar un botón "Iniciar sesión" **deshabilitado visualmente o apuntando a `/login`** solo cuando exista; hasta F2, no mostrarlo. Dejar un comentario `TODO(F2)` en el lugar.
   - El buscador del header lleva a `/catalogo?q=...` (formulario GET, sin JS obligatorio).
4. **`SiteFooter`**: marca, enlaces de navegación, Instagram, WhatsApp, año dinámico.
5. **`WhatsAppFab`**: botón flotante abajo a la derecha (móvil y escritorio) con enlace `https://wa.me/<numero>?text=<mensaje>` y mensaje genérico de contacto. `target="_blank" rel="noopener noreferrer"`, `aria-label`.
6. **Número y redes desde la base de datos:** crear `src/server/config.ts` con `getDealerConfig()` que lea `whatsapp_numero` e `instagram_url` de `configuracion_concesionario` y use `NEXT_PUBLIC_WHATSAPP_NUMBER` como respaldo si la BD no responde o falta la clave. Debe tratarse con la estrategia de caché de esta versión de Next (datos que casi no cambian; revalidar con etiqueta/`cacheTag` o equivalente que indique la documentación).
7. Util `src/lib/whatsapp.ts`: `buildWhatsAppUrl(number: string, message: string): string` que sanee el número (solo dígitos) y use `encodeURIComponent`. Con tests de Vitest (número con `+` y espacios, mensaje con tildes y `&`).
8. Iconos con `lucide-react` (ver `docs/ICON_MAPPING.md`); el icono de WhatsApp e Instagram son SVG propios porque lucide no incluye logos de marca.

## Fuera de alcance

Autenticación, menú de usuario, notificaciones, modo oscuro.

## Criterios de aceptación

- [x] Todas las rutas públicas muestran header, footer y botón flotante, y se ven bien a 360 px, 768 px y 1280 px (sin scroll horizontal).
- [x] La navegación completa funciona con teclado; el menú móvil se cierra con Esc y devuelve el foco.
- [x] Contraste y `aria-label` revisados (Lighthouse accesibilidad ≥ 95 en `/`).
- [x] Si la BD está apagada, el sitio sigue renderizando con el número de respaldo.
- [x] Las cifras de marca solo aparecen definidas en `site-content.ts`.
- [x] `pnpm check` y `pnpm build` pasan.

## Verificación

```bash
pnpm build && git status --short
pnpm check
```

## Notas de entrega

### Qué se hizo

1. Se reestructuró la portada moviendo `src/app/page.tsx` a `src/app/(public)/page.tsx` y se implementó el layout común `src/app/(public)/layout.tsx`.
2. Se creó `src/lib/site-content.ts` centralizando todas las cifras provisorias de marca (`trustMetrics`), títulos hero, enlaces de navegación y redes con su respectivo `TODO(owner)`.
3. Se construyó el utilitario `src/lib/whatsapp.ts` y su suite de pruebas unitarias en `src/lib/whatsapp.test.ts` pasando al 100%.
4. Se creó `src/components/ui/BrandIcons.tsx` con SVG semánticos de WhatsApp e Instagram accesibles.
5. Se creó `src/server/config.ts` con `getDealerConfig()` aprovechando Cache Components (`'use cache'` y `cacheTag('dealer-config')`), con tolerancia a fallos y respaldo automático si la base de datos MySQL está caída o inaccesible (verificado con `pnpm db:down` y `pnpm build`).
6. Se implementó `SiteHeader` (con buscador estándar GET `/catalogo?q=...`, sin perfiles simulados, con comentario `TODO(F2)`) y el menú hamburguesa accesible `MobileMenu` con foco atrapado y retorno al trigger al pulsar Escape.
7. Se implementaron `SiteFooter` y `WhatsAppFab` respetando tokens de diseño de `docs/DESIGN.md`.
8. Se ejecutó `pnpm check` y `pnpm build` con éxito sin errores de linting, tipos o formateo.
