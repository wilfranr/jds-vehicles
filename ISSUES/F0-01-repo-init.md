# F0-01: Inicializar repositorio, README y `.env.example`

- **Estado:** REVIEW
- **Fase:** 0
- **Depende de:** —
- **Prioridad:** Alta (bloquea todo lo demás)

## Contexto
El directorio del proyecto no es un repositorio git y no tiene README ni gestión de variables de entorno. Contiene documentos de diseño y el SQL original que deben conservarse.

## Alcance
1. `git init` en la raíz (rama por defecto `main`) y un primer commit con los archivos actuales.
2. `.gitignore` adecuado para Node/Next.js: `node_modules`, `.next`, `.env*` (excepto `.env.example`), `coverage`, `*.log`, `.DS_Store`, `/uploads`.
3. Mover los artefactos de diseño a una carpeta `docs/`, sin borrar nada:
   - `DOCUMENTACION.md`, `DESIGN.md` → `docs/`
   - `code.html`, `screen.png`, `logo.jpg` → `docs/prototype/` (`logo.jpg` se copiará a `public/` en F0-02).
   - `stitch_concesionario_digital_autoreserve.zip` → `docs/prototype/`
   - `database.sql` → `docs/legacy/database.sql` (referencia histórica; el esquema real será Prisma, ver F0-04).
   - `database_modelo.xlsx` → `docs/legacy/`
   - Usar `git mv` tras el primer commit para conservar historial, y actualizar los enlaces rotos dentro de `DOCUMENTACION.md` (referencia a `database.sql`) y `ISSUES/README.md`.
   - `ISSUES/` se queda en la raíz.
4. `README.md` en la raíz con: descripción del proyecto, stack, requisitos (Node LTS, pnpm, Docker), pasos de arranque en local (se completarán en issues posteriores; dejar marcadores `TODO(F0-0x)`), estructura de carpetas y enlace a `ISSUES/README.md`.
5. `.env.example` con las variables previstas y comentarios, sin valores secretos:
   - `DATABASE_URL="mysql://jds:jds@localhost:3306/jds_vehiculos"`
   - `AUTH_SECRET=` (para Fase 2)
   - `NEXT_PUBLIC_SITE_URL="http://localhost:3000"`
   - `NEXT_PUBLIC_WHATSAPP_NUMBER=573202353168` (la fuente de verdad será la tabla `configuracion_concesionario`; esto es solo fallback)

## Fuera de alcance
Instalar dependencias, crear el proyecto Next.js o tocar el contenido de los documentos más allá de corregir enlaces.

## Criterios de aceptación
- [x] `git status` limpio y `git log` muestra al menos 2 commits (inicial + reorganización).
- [x] Ningún archivo original se perdió (verificar con `git ls-files`).
- [x] `.env` está ignorado; `.env.example` está versionado.
- [x] `README.md` explica qué es el proyecto y cómo navegar la documentación.
- [x] Los enlaces internos de los `.md` funcionan tras mover los archivos.

## Verificación
```bash
git status
git log --oneline
git ls-files | sort
git check-ignore -v .env
```

## Notas
Mensajes de commit en español, formato `tipo: descripción` (feat, fix, chore, docs).

## Notas de entrega
- **Qué se hizo:**
  1. Inicialización del repositorio git en la rama `main` y creación de rama `issue/F0-01-repo-init`.
  2. Commit inicial preservando el 100% de los archivos originales.
  3. Reorganización de artefactos con `git mv`:
     - `docs/DOCUMENTACION.md`, `docs/DESIGN.md`
     - `docs/prototype/` (`code.html`, `screen.png`, `logo.jpg`, `stitch_concesionario_digital_autoreserve.zip`)
     - `docs/legacy/` (`database.sql`, `database_modelo.xlsx`)
  4. Corrección de referencias en `docs/DOCUMENTACION.md` y `ISSUES/README.md`.
  5. Creación de `.gitignore` completo para Node/Next.js (ignorando `.env*` excepto `.env.example`, `node_modules`, `.next`, `coverage`, `/uploads`, logs, etc.).
  6. Creación de `.env.example` con variables base requeridas y comentarios explicativos.
  7. Creación de `README.md` en la raíz con descripción, stack, requisitos previos, estructura de carpetas, pasos locales con marcadores `TODO(F0-0x)` y enlace a `ISSUES/README.md`.
- **Desviaciones:** Ninguna.
- **Comandos de verificación ejecutados con éxito:**
  - `git status`
  - `git log --oneline`
  - `git ls-files | sort`
  - `git check-ignore -v .env`
