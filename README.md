# JDS Vehículos

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

*Nota: La estructura del código fuente (`src/`, `prisma/`, etc.) se creará en issues posteriores (ver F0-02).*

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

5. **Ejecutar migraciones y seed:**
   ```bash
   pnpm db:migrate
   # TODO(F0-05): pnpm db:seed
   ```

6. **Iniciar servidor de desarrollo:**
   ```bash
   pnpm dev
   ```

## Gestión del Proyecto

El desarrollo se gestiona a través del backlog de tareas ubicado en la carpeta [ISSUES/](ISSUES/README.md). Consulta dicho archivo para conocer el flujo de trabajo, convenciones y el estado de cada fase.
