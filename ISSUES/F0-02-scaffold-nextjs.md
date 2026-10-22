# F0-02: Scaffold Next.js + TypeScript + estructura de carpetas

- **Estado:** TODO
- **Fase:** 0
- **Depende de:** F0-01
- **Prioridad:** Alta

## Contexto
Se necesita la base de la aplicación en la raíz del repositorio (no en subcarpeta). Decisión: Next.js App Router, TypeScript estricto, pnpm, Tailwind.

## Alcance
1. Crear la app Next.js (última versión estable) en la raíz con: TypeScript, App Router, Tailwind CSS, ESLint, alias de importación `@/*`, directorio `src/`. Usar `pnpm`. Si `create-next-app` se queja de archivos existentes, generarlo en un directorio temporal y mover el resultado sin sobrescribir `README.md`, `.gitignore`, `.env.example` ni `docs/` (fusionar a mano).
2. `tsconfig.json` con `"strict": true` y `noUncheckedIndexedAccess: true`.
3. Fijar versión de Node en `.nvmrc` y `engines` de `package.json`; fijar `packageManager` (pnpm).
4. Estructura inicial dentro de `src/`:
   ```
   src/
     app/
       (public)/        # catálogo, detalle, etc. (Fase 1)
       (auth)/          # login/registro (Fase 2)
       (admin)/         # panel concesionario (Fase 4)
       api/health/route.ts
       layout.tsx
       page.tsx
     components/ui/     # componentes base reutilizables
     lib/               # utilidades (db.ts se crea en F0-04)
     server/            # lógica de servidor / servicios
     types/
   public/
   ```
   Las carpetas vacías llevan `.gitkeep`.
5. Copiar `docs/prototype/logo.jpg` a `public/logo.jpg`.
6. `GET /api/health` responde `200` con `{ "status": "ok" }` (más adelante incluirá chequeo de BD).
7. `src/app/page.tsx` con una página provisional mínima en español ("JDS Vehículos: próximamente"). Sin lógica de negocio.
8. Scripts en `package.json`: `dev`, `build`, `start`, `lint`, `typecheck` (`tsc --noEmit`).

## Fuera de alcance
Tokens de diseño (F0-03), Prisma (F0-04), pruebas/Prettier (F0-06). No instalar Auth.js todavía.

## Criterios de aceptación
- [ ] `pnpm install && pnpm dev` levanta en `http://localhost:3000`.
- [ ] `curl localhost:3000/api/health` devuelve `{"status":"ok"}`.
- [ ] `pnpm build`, `pnpm lint` y `pnpm typecheck` pasan sin errores ni warnings.
- [ ] Estructura de carpetas creada como se describe.
- [ ] `README.md` actualizado con los comandos reales (reemplaza el `TODO(F0-02)`).

## Verificación
```bash
pnpm install
pnpm typecheck && pnpm lint && pnpm build
pnpm dev &  curl -s localhost:3000/api/health
```
