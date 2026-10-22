# F0-03: Tailwind: tokens de diseño y tipografía

- **Estado:** DONE
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

- [x] Las clases usadas en `code.html` (ej. `bg-surface-container-low`, `text-headline-xl`, `rounded-xl`, `px-gutter`) existen y producen el mismo resultado visual.
- [x] La fuente se sirve desde el propio dominio (sin petición a `fonts.googleapis.com` en runtime del cliente).
- [x] La página `/_design` muestra paleta, escalas tipográficas y los 5 badges correctamente; devuelve 404 en producción.
- [x] `pnpm lint`, `pnpm typecheck`, `pnpm build` pasan.

## Verificación

Abrir `/_design` junto a `docs/prototype/screen.png` y comparar colores y tipografía. Revisar Network en DevTools para la fuente.

## Notas de entrega

- **Qué se hizo:**
  1. Configuración completa del sistema de diseño en `src/app/globals.css` mediante la directiva `@theme` de Tailwind v4:
     - Paleta de colores completa de `DESIGN.md` (surfaces, on-surfaces, primary/secondary/tertiary y sus variantes fijas).
     - Paleta semántica de estado (`status-nuevo`, `status-seminuevo`, `status-reservado`, `status-vendido`, `status-proximamente` con texto, fondo y bordes) y color de marca `whatsapp` (`#25D366`).
     - Tokens de espaciado (`gutter`, `gutter-mobile`, `margin`, `margin-mobile`, `space-xs`, `space-sm`, `space-md`, `space-lg`, `space-xl`).
     - Radios de borde según especificación.
     - Escala tipográfica con tamaño, altura de línea, espaciado de letras y peso de fuente integrados.
  2. Carga y autoalojamiento de **Plus Jakarta Sans** (pesos 400, 600, 700, 800) mediante `next/font/google` en `src/app/layout.tsx`.
  3. Instalación de `lucide-react` y generación del documento de mapeo de iconos en `docs/ICON_MAPPING.md`.
  4. Creación del componente `src/components/ui/StatusBadge.tsx` con soporte para los 5 estados especificados (`NUEVO`, `USADO` renderizado como SEMINUEVO, `RESERVADO`, `VENDIDO`, `PROXIMAMENTE`).
  5. Creación de la ruta "kitchen sink" en `src/app/(public)/%5Fdesign/page.tsx` para visualización de badges, paleta y tipografía. Se validó que devuelve HTTP 404 cuando `NODE_ENV === 'production'`.
- **Desviaciones:** Ninguna.
- **Comandos de verificación ejecutados con éxito:**
  - `pnpm typecheck` (tsc sin errores)
  - `pnpm lint` (eslint limpio)
  - `pnpm build` (build Turbopack exitoso)
  - `curl -i http://localhost:3000/_design` en modo dev (200 OK con contenido)
  - `curl -i http://localhost:3000/_design` con `NODE_ENV=production` (404 Not Found)
