# F0-03: Tailwind: tokens de diseño y tipografía

- **Estado:** TODO
- **Fase:** 0
- **Depende de:** F0-02
- **Prioridad:** Media

## Contexto
El sistema de diseño "Velocita Motors" está en `docs/DESIGN.md` y su implementación de referencia en `docs/prototype/code.html` (bloque `tailwind.config`, que usa Tailwind por CDN). Hay que llevarlo a la configuración real del proyecto para que las fases siguientes reutilicen los mismos nombres de clase (`bg-surface-container-low`, `text-on-surface`, `font-headline-xl`, etc.).

## Alcance
1. Trasladar a la configuración de Tailwind del proyecto (según la versión instalada: `tailwind.config.ts` o `@theme` en CSS):
   - `colors` completos del frontmatter de `DESIGN.md`.
   - `borderRadius`, `spacing` (`margin`, `gutter`, `space-*`), `fontFamily` y `fontSize` (con lineHeight, letterSpacing y fontWeight) tal como en `code.html`.
2. Cargar **Plus Jakarta Sans** con `next/font/google` (pesos 400, 600, 700, 800), expuesta como variable CSS y aplicada al `body`. No enlazar Google Fonts por `<link>`.
3. Iconos: usar `lucide-react` (o `material-symbols` autoalojado) en lugar del `<link>` de Material Symbols del prototipo. Decisión: **lucide-react**; mapear los iconos usados en el prototipo en una nota para fases siguientes (no implementarlos todos).
4. Estilos base en `globals.css`: fondo `bg-background`, texto `text-on-surface`, `antialiased`.
5. Añadir además las variables semánticas **de estado** de `DESIGN.md` ("Status Semantic Palette": nuevo, seminuevo, reservado, vendido, próximamente; con texto, fondo y borde) y del botón WhatsApp (`#25D366`), como tokens utilizables (ej. `bg-status-nuevo-bg`, `text-status-nuevo`, `bg-whatsapp`).
6. Componente `src/components/ui/StatusBadge.tsx`: recibe `status: 'NUEVO' | 'USADO' | 'RESERVADO' | 'VENDIDO' | 'PROXIMAMENTE'` y pinta el chip pill según `DESIGN.md` (`USADO` se muestra como "SEMINUEVO"; `VENDIDO` con opacidad reducida es responsabilidad de la tarjeta, no del badge).
7. Ruta temporal `src/app/(public)/_design/page.tsx` ("kitchen sink") mostrando paleta, tipografías y todos los `StatusBadge`. Debe quedar excluida de producción (`notFound()` si `NODE_ENV === 'production'`).

## Fuera de alcance
Header, footer, tarjetas de vehículo y demás componentes (Fase 1). Modo oscuro.

## Criterios de aceptación
- [ ] Las clases usadas en `code.html` (ej. `bg-surface-container-low`, `text-headline-xl`, `rounded-xl`, `px-gutter`) existen y producen el mismo resultado visual.
- [ ] La fuente se sirve desde el propio dominio (sin petición a `fonts.googleapis.com` en runtime del cliente).
- [ ] La página `/_design` muestra paleta, escalas tipográficas y los 5 badges correctamente; devuelve 404 en producción.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm build` pasan.

## Verificación
Abrir `/_design` junto a `docs/prototype/screen.png` y comparar colores y tipografía. Revisar Network en DevTools para la fuente.
