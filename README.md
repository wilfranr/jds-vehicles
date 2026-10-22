# JDS Vehículos

[![CI Pipeline](https://github.com/wilfranr/jds-vehicles/actions/workflows/ci.yml/badge.svg)](https://github.com/wilfranr/jds-vehicles/actions/workflows/ci.yml)

Plataforma digital para concesionario de vehículos con catálogo público, filtros avanzados, cotizador/reserva y panel administrativo.

## Stack Tecnológico

- **Framework:** [Next.js](https://nextjs.org/) (App Router) + TypeScript estricto
- **Estilos:** [Tailwind CSS](https://tailwindcss.com/) (Sistema de diseño Velocita Motors)
- **Base de Datos & ORM:** [MySQL 8.0+](https://www.mysql.com/) + [Prisma](https://www.prisma.io/)
- **Autenticación:** [Auth.js](https://authjs.dev/) (Fase 2)
- **Gestor de Paquetes:** [pnpm](https://pnpm.io/)

## Requisitos Previos

- **Node.js**: Versión LTS (v20+ recomendada)
- **pnpm**: Versión 9+ (`npm install -g pnpm` o vía corepack)
- **Docker & Docker Compose**: Para entorno local de base de datos MySQL

## Estructura del Proyecto

```text
jds-vehicules/
├── docs/                      # Documentación del proyecto y especificaciones
│   ├── legacy/                # Modelo SQL y esquemas originales de referencia
│   ├── prototype/             # Prototipo HTML/CSS y assets visuales
│   ├── DESIGN.md              # Sistema de diseño y tokens ("Velocita Motors")
│   └── DOCUMENTACION.md       # Reglas de negocio, ERD y diccionario de datos
├── ISSUES/                    # Backlog de tareas y seguimiento por fases
│   └── README.md              # Índice de issues y flujo de desarrollo
├── .env.example               # Plantilla de variables de entorno
└── README.md                  # Documentación principal
```

_Nota: La estructura del código fuente (`src/`, `prisma/`, etc.) se creará en issues posteriores (ver F0-02)._

## Puesta en Marcha (Entorno Local)

1. **Clonar el repositorio:**

   ```bash
   git clone <repo-url>
   cd jds-vehicules
   ```

2. **Configurar variables de entorno:**

   ```bash
   cp .env.example .env
   ```

3. **Instalar dependencias:**

   ```bash
   pnpm install
   ```

4. **Iniciar base de datos con Docker:**

   ```bash
   pnpm db:up
   ```

5. **Ejecutar migraciones y sembrar datos:**

   ```bash
   pnpm db:migrate
   pnpm db:seed
   ```

   _Nota: En desarrollo, `pnpm db:seed` siembra datos de referencia (roles y configuración) más datos de demostración (usuarios, marcas, modelos y vehículos con fotos). En producción (`NODE_ENV=production`), solo siembra datos de referencia a menos que se invoque con la bandera `--demo` (`pnpm db:seed --demo`), en cuyo caso se exige definir `SEED_ADMIN_PASSWORD` y `SEED_CLIENT_PASSWORD` para evitar contraseñas por defecto._

6. **Iniciar servidor de desarrollo:**
   ```bash
   pnpm dev
   ```

## Calidad y Pruebas

El proyecto cuenta con herramientas estandarizadas de calidad de código y pruebas automáticas:

- `pnpm format`: Da formato al código usando Prettier y el plugin oficial de Tailwind.
- `pnpm format:check`: Verifica el formateo sin modificar archivos.
- `pnpm lint`: Ejecuta ESLint con reglas para TypeScript y compatibilidad con Prettier.
- `pnpm typecheck`: Valida tipos en modo estricto (`tsc --noEmit`).
- `pnpm test`: Corre las pruebas unitarias y de componentes con Vitest.
- `pnpm test:watch`: Ejecuta las pruebas en modo observador.
- `pnpm e2e`: Corre las pruebas de recorrido con Playwright (Chromium). Requiere BD sembrada y `pnpm build` previo; levanta `pnpm start` en el puerto 3100 (`E2E_PORT`) o usa un servidor existente con `E2E_BASE_URL`. La primera vez: `pnpm exec playwright install chromium`.
- `pnpm check`: Ejecuta toda la suite de calidad en secuencia (`format:check`, `lint`, `typecheck` y `test`).

Adicionalmente, se cuenta con hooks de Git configurados con **Husky** y **lint-staged** que formatean automáticamente los archivos preparados para commit y bloquean commits si existen errores de ESLint.

## Rutas Públicas

| Ruta              | Descripción                                                 |
| :---------------- | :---------------------------------------------------------- |
| `/`               | Portada con vehículos destacados                            |
| `/catalogo`       | Catálogo con filtros y paginación por query string          |
| `/vehiculos/[id]` | Detalle del vehículo con galería, datos estructurados y CTA |
| `/proximamente`   | Vehículos por ingresar al inventario                        |
| `/como-funciona`  | Proceso de compra y preguntas frecuentes                    |
| `/contacto`       | Canales de atención                                         |
| `/sitemap.xml`    | Sitemap (páginas públicas y vehículos visibles no vendidos) |
| `/robots.txt`     | Reglas para buscadores (excluye `/api` y `/_design`)        |
| `/api/health`     | Comprobación de salud (no indexada)                         |

## Gestión del Proyecto

El desarrollo se gestiona a través del backlog de tareas ubicado en la carpeta [ISSUES/](ISSUES/README.md). Consulta dicho archivo para conocer el flujo de trabajo, convenciones y el estado de cada fase.

> [!NOTE]
> El pipeline de despliegue continuo (CD) hacia el servidor en Oracle Cloud vía SSH será implementado en la **Fase 6** del proyecto.
