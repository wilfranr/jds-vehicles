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
   openssl rand -base64 32   # pegar el resultado en AUTH_SECRET
   ```

   `AUTH_SECRET` firma las sesiones de Auth.js y es obligatoria en producción (el servidor se niega a arrancar sin ella). Detrás de un proxy inverso define también `AUTH_TRUST_HOST=true`. Las sesiones son JWT en cookie `HttpOnly` + `SameSite=Lax` (`Secure` en producción), duran como máximo 7 días y se renuevan cada 24 h de actividad.

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

   **Usuarios de prueba** (solo desarrollo y e2e; el seed usa `SEED_ADMIN_PASSWORD` / `SEED_CLIENT_PASSWORD`, por defecto `Admin123*` y `Cliente123*`): `admin@jdsvehiculos.com` (rol `ADMIN`) y `carlos.gomez@example.com` (rol `CLIENTE`). Tras probar cambios de perfil o contraseña, `pnpm db:seed` restaura sus datos.

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
- `pnpm e2e`: Corre las pruebas de recorrido con Playwright (Chromium). Requiere BD sembrada y `pnpm build` previo; levanta `pnpm start` en el puerto 3100 (`E2E_PORT`) o usa un servidor existente con `E2E_BASE_URL`. La primera vez: `pnpm exec playwright install chromium`. El servidor de e2e arranca con `AUTH_TRUST_HOST=true` y `TRUST_PROXY=true`: cada prueba de `e2e/auth.spec.ts` envía su propia IP en `X-Forwarded-For`, así los limitadores no se pisan entre pruebas ni entre ejecuciones (si usas `E2E_BASE_URL`, el servidor debe tener `TRUST_PROXY=true`). Las pruebas borran los usuarios que crean y `e2e/global-setup.ts` falla si el número de `usuarios` cambia. Los e2e son obligatorios en CI.
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

## Expiración de Reservas

`pnpm reservas:expirar` (`scripts/expire-reservations.ts`) marca como `EXPIRADA` las reservas `PENDIENTE_CONTACTO` cuya `fechaExpiracion` ya pasó y devuelve el vehículo a `DISPONIBLE` si sigue `RESERVADO` y no tiene otra reserva activa. No toca reservas `EN_NEGOCIACION`, `COMPLETADA` ni `CANCELADA`, ni las que no tienen fecha de expiración. Es idempotente. Imprime una línea JSON (`{"expiradas":n,"vehiculosLiberados":m}`) y sale con código 1 si falla. Con `RESERVA_EXPIRACION_HORAS=0` (expiración desactivada) no hace nada.

Debe ejecutarse desde el directorio del proyecto (lee `DATABASE_URL` de `.env`) con un `cron` del servidor, por ejemplo cada 15 minutos (se configura en la Fase 6):

```cron
*/15 * * * * cd /ruta/al/proyecto && pnpm -s reservas:expirar >> /var/log/jds-reservas-expirar.log 2>&1
```

No existe una ruta HTTP para esto. Como el script corre en un proceso aparte, **no puede invalidar la caché de Next** (`updateTag`/`revalidateTag` solo funcionan dentro del servidor). Comprobado: el listado `/catalogo` y la ficha del vehículo leen la BD en cada visita y reflejan la expiración de inmediato; solo las consultas cacheadas (portada y filtros del catálogo, ~60 s; vehículos similares, perfil por defecto de 15 min) se ponen al día cuando vence su caché.

## Rutas de Autenticación y Cuenta

| Ruta                   | Descripción                                                                                                        |
| :--------------------- | :----------------------------------------------------------------------------------------------------------------- |
| `/registro`            | Alta de clientes (inicia sesión al terminar); limitada a 5 envíos por hora y por IP                                |
| `/login`               | Inicio de sesión; limitado a 5 fallos por correo+IP y 20 por IP cada 15 min. Acepta `?next=` (solo rutas internas) |
| `/mi-cuenta`           | Perfil: edición de nombre, apellido, teléfono, ciudad y dirección (requiere sesión)                                |
| `/mi-cuenta/seguridad` | Cambio de contraseña (5 fallos de la actual por usuario cada 15 min)                                               |
| `/mi-cuenta/reservas`  | Mis reservas; el detalle `/mi-cuenta/reservas/[codigo]` solo abre reservas propias                                 |
| `/admin/**`            | Reservada al personal (`ADMIN`/`ASESOR`); aún sin páginas                                                          |
| `/api/auth/**`         | Rutas internas de Auth.js (las pantallas de acceso redirigen a `/login`)                                           |

Las rutas de cuenta, `/login` y `/registro` llevan `noindex` y no están en el sitemap.

## Checklist de Despliegue (producción, detrás de proxy inverso)

Variables de entorno obligatorias o recomendadas (ver `.env.example`):

- `AUTH_SECRET`: obligatoria; el servidor no arranca sin ella (`openssl rand -base64 32`).
- `AUTH_TRUST_HOST=true`: obligatoria detrás del proxy inverso; sin ella Auth.js responde 500 `UntrustedHost`.
- `TRUST_PROXY=true` y `TRUST_PROXY_HOPS=<n>`: para que la limitación de intentos use la IP real del cliente (`X-Forwarded-For`). El proxy debe **añadir** la IP del cliente a esa cabecera, no confiar en la que envíe el cliente.
  **Obligatorio en producción:** sin `TRUST_PROXY=true` todos los visitantes comparten el cupo `unknown`, y como el registro admite 5 envíos por hora y por IP, bastarían 5 envíos para bloquear el registro a todo el mundo (y 20 fallos de login para bloquear el inicio de sesión).
- `RESERVA_EXPIRACION_HORAS` (opcional): horas de vigencia de una reserva, entero positivo. Sin ella, 48 horas (decisión del demo, `TODO(owner)`: confirmar antes de producción); `0` desactiva la expiración. Un valor inválido hace que el servidor se niegue a arrancar.
- `NEXT_PUBLIC_SITE_URL`, `DATABASE_URL`.

Notas de seguridad: la limitación de intentos es **en memoria** y solo es válida con un único proceso de Node; con varias instancias debe sustituirse por una implementación con la base de datos (ver `src/server/security/rate-limit.ts`). El proxy de Next (`src/proxy.ts`) es solo la primera barrera: las páginas y acciones privadas vuelven a comprobar sesión y rol, y las operaciones sensibles usan `getFreshUser()`.

## Gestión del Proyecto

El desarrollo se gestiona a través del backlog de tareas ubicado en la carpeta [ISSUES/](ISSUES/README.md). Consulta dicho archivo para conocer el flujo de trabajo, convenciones y el estado de cada fase.

> [!NOTE]
> El pipeline de despliegue continuo (CD) hacia el servidor en Oracle Cloud vía SSH será implementado en la **Fase 6** del proyecto.
