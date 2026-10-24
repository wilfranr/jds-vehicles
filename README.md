# JDS Vehículos - elaborado por Dominique Rivera

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
- `pnpm test`: Corre las pruebas unitarias y de componentes con Vitest, en dos proyectos: `unit` (sin BD, en paralelo) y `db` (archivos `*.db.test.ts`, que usan la BD sembrada y se ejecutan **uno tras otro**: comparten la base de datos y varios cuentan filas globales). **Toda prueba que use la BD real debe llamarse `*.db.test.ts`** y limpiar sus filas; las de `e2e/` se ejecutan aparte con `pnpm test:e2e`.
- `pnpm test:watch`: Ejecuta las pruebas en modo observador.
- `pnpm test:e2e` (alias de `pnpm e2e`): Corre las pruebas de recorrido con Playwright (Chromium). Requiere BD sembrada y `pnpm build` previo; levanta `pnpm start` en el puerto 3100 (`E2E_PORT`) o usa un servidor existente con `E2E_BASE_URL`. La primera vez: `pnpm exec playwright install chromium`. El servidor de e2e arranca con `AUTH_TRUST_HOST=true` y `TRUST_PROXY=true`: cada prueba de `e2e/auth.spec.ts` envía su propia IP en `X-Forwarded-For`, así los limitadores no se pisan entre pruebas ni entre ejecuciones (si usas `E2E_BASE_URL`, el servidor debe tener `TRUST_PROXY=true`). Las pruebas borran los usuarios que crean y `e2e/global-setup.ts` falla si el número de `usuarios` cambia. Los e2e son obligatorios en CI.
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

## Panel

`/admin` es el panel del concesionario para el personal (roles `ADMIN` y `ASESOR`). Tiene armazón propio (no usa el header público), todo el panel lleva `noindex` y está excluido del sitemap y de `robots.txt`, y no produce scroll horizontal a 360 px.

### Roles y permisos

Decisión del demo por delegación del propietario (**confirmar antes de producción**): el `ASESOR` gestiona reservas, ventas e inventario; solo el `ADMIN` gestiona usuarios y la configuración del concesionario. El `CLIENTE` no tiene acceso: recibe 404 en todo `/admin`.

| Sección           | Ruta                                                                                              | `ASESOR` | `ADMIN` |
| :---------------- | :------------------------------------------------------------------------------------------------ | :------: | :-----: |
| Resumen           | `/admin`                                                                                          |    sí    |   sí    |
| Reservas          | `/admin/reservas`, `/admin/reservas/[codigo]` (incluye «Registrar venta»)                         |    sí    |   sí    |
| Ventas            | `/admin/ventas`, `/admin/ventas/[recibo]` (solo lectura)                                          |    sí    |   sí    |
| Vehículos y fotos | `/admin/vehiculos`, `/nuevo`, `/[id]` (con galería), `/marcas` (marcas y modelos), `POST …/fotos` |    sí    |   sí    |
| Usuarios          | `/admin/usuarios`                                                                                 |    no    |   sí    |
| Configuración     | `/admin/configuracion`                                                                            |    no    |   sí    |

### Flujo de trabajo típico

1. **Inventario:** el personal crea el vehículo en `/admin/vehiculos/nuevo` y sube sus fotos en `/admin/vehiculos/[id]`; aparece de inmediato en `/catalogo` (cada cambio invalida la caché del catálogo).
2. **Reserva:** un cliente con sesión reserva desde la ficha pública (el vehículo queda `RESERVADO`). El personal la encuentra en `/admin/reservas` (por código o correo), escribe al cliente por WhatsApp desde el detalle y la pasa a `EN_NEGOCIACION`.
3. **Cierre:** «Registrar venta» (precio final, método de pago, observaciones) deja la reserva `COMPLETADA`, el vehículo `VENDIDO` y oculto del catálogo (su ficha pública responde «no encontrado») y crea la venta con su recibo `VTA-AAAA-NNNNNN`.
4. **Cancelación o expiración:** cancelar una reserva (con motivo opcional) o dejar que expire (`pnpm reservas:expirar`, ver «Expiración de Reservas») devuelve el vehículo a `DISPONIBLE` si no tiene otra reserva activa.

### Seguridad y reglas para quien añada páginas o acciones

- **Varias barreras, ninguna única:** el proxy (`src/proxy.ts`) decide con el JWT sin consultar la BD (anónimo → login, `CLIENTE` → 404, `ASESOR` en usuarios/configuración → 404), pero **cada página y cada Server Action** vuelve a llamar a `requireStaff()` o `requireAdmin()` (`src/server/auth/staff.ts`), que confirman el rol vigente y que la cuenta siga activa **en la BD**. El JWT dura 7 días y no se revoca: un cambio de rol solo lo ve el proxy cuando la persona vuelve a iniciar sesión, pero las páginas y acciones del panel rechazan de inmediato a un usuario degradado o desactivado (con la sesión aún abierta). El layout no es una barrera: no se vuelve a ejecutar en cada navegación.
- El rol y el id del actor salen de la sesión/BD, nunca del formulario; los ids de los registros afectados llegan enlazados desde la página y se validan; campos editables en listas explícitas; validación con Zod en el servidor.
- Cada cambio relevante escribe un evento con `logAdminEvent` (`src/server/admin/audit.ts`): una línea JSON del canal `admin` con quién, qué y el id afectado, sin datos personales ni secretos (las observaciones y las contraseñas nunca se registran).
- Los mensajes nunca revelan si existe un registro ajeno; los códigos y recibos mal formados responden «no encontrado».
- Los datos sensibles se muestran mínimos: el documento de identidad siempre enmascarado (últimos 3 caracteres) y nunca se consulta el hash de las contraseñas.
- Las operaciones con varias tablas (reservar, cancelar, vender, expirar) son transacciones con las filas bloqueadas (`FOR UPDATE`) y cambios condicionados al estado leído, así que dos personas actuando a la vez producen un solo efecto y un aviso para la otra.

### Módulos

**Vehículos (F4-03):** un único esquema Zod (`src/lib/validation/vehicle.ts`) para crear y editar: placa obligatoria y normalizada para seminuevos, sin placa y 0 km para nuevos, precio decimal exacto, y la placa debe ser única entre vehículos no vendidos. La disponibilidad solo se cambia a mano entre `DISPONIBLE` y `PROXIMAMENTE`; con una reserva activa solo se editan precio y descripción y no se puede ocultar; un vehículo vendido es de solo lectura. Marcas y modelos se crean, renombran y desactivan (no se eliminan).

**Fotos (F4-04):** ver la sección «Fotos de Vehículos» (`UPLOADS_DIR`, permisos, copias de seguridad, límites y seguridad de la subida).

**Reservas del personal (F4-02):** `/admin/reservas` (activas primero, filtro por estado, búsqueda por código o correo) y `/admin/reservas/[codigo]` (datos del cliente con el documento enmascarado, vehículo con placa, observaciones internas y botón de WhatsApp al cliente). Máquina de estados en `src/server/reservations/transitions.ts`: `PENDIENTE_CONTACTO → EN_NEGOCIACION | CANCELADA` y `EN_NEGOCIACION → CANCELADA`; `COMPLETADA` solo la produce el registro de una venta y `EXPIRADA` el proceso de expiración. Cancelar devuelve el vehículo a `DISPONIBLE` solo si sigue `RESERVADO` y no tiene otra reserva activa.

**Ventas (F4-05):** «Registrar venta» desde una reserva activa. En **una sola transacción** (`src/server/admin/sales.ts`): reserva → `COMPLETADA`, vehículo → `VENDIDO` con `visible_catalogo = false` y fila en `ventas` con el recibo `VTA-AAAA-NNNNNN` (consecutivo anual generado en el servidor, serializado con una fila de exclusión mutua y protegido por el índice único). El **comprador es el usuario de la reserva y el vendedor el usuario de la sesión**. `/admin/ventas` lista con filtro por rango de fechas (días de Bogotá) y el **total del periodo como suma decimal exacta**; el detalle es de solo lectura: las ventas no se editan ni se eliminan desde el panel.

**Usuarios (F4-06, solo `ADMIN`):** buscar por nombre o correo, activar/desactivar cuentas, cambiar el rol y restablecer la contraseña (se genera una temporal aleatoria de 16 caracteres, se guarda solo su hash bcrypt de coste 12 y se muestra **una única vez**; se comunica por un canal seguro y la persona la cambia en «Mi cuenta»; límite de 10 restablecimientos por hora por administrador). Salvaguardas: nadie se desactiva ni se quita el rol ADMIN a sí mismo (ni restablece su propia clave desde aquí) y **siempre queda al menos un ADMIN activo**, también con dos administradores actuando a la vez. Desactivar no cancela las reservas activas (se avisa con un enlace).

**Configuración (F4-07, solo `ADMIN`):** edita únicamente las claves de la lista blanca `whatsapp_numero` e `instagram_url` (`src/lib/validation/dealer-config.ts`). WhatsApp se normaliza a `57XXXXXXXXXX` e Instagram debe ser `https` de `instagram.com` o `www.instagram.com`. Vista previa del enlace y confirmación (el servidor también la exige); al guardar se invalida la etiqueta `dealer-config` y el sitio usa el nuevo valor sin reiniciar. El evento `config_changed` registra el valor anterior y el nuevo (datos del negocio, no personales).

### Pruebas del panel

- Pruebas con la BD real: archivos `*.db.test.ts` (corren en serie en el proyecto `db` de Vitest). E2E en `e2e/`: flujo completo del personal, cancelación, **matriz de autorización** (anónimo, `CLIENTE`, `ASESOR`, `ADMIN` y un usuario degradado con sesión vigente, tanto en rutas como reenviando las Server Actions reales de usuarios y configuración), indexación (`noindex`, sitemap, `robots.txt`) y cada módulo.
- Cada prueba e2e crea sus **propios datos** (correo `@e2e-test.local`, vehículo de color `E2E-RESERVAS-…`, marcas `E2E-MARCA-…`), nunca abre «la primera tarjeta» del catálogo ni cuenta filas globales, y los borra aunque falle (con sus fotos, reservas y ventas). `e2e/global-setup.ts` barre restos de ejecuciones interrumpidas y, al terminar, **falla si queda algún usuario, vehículo, reserva, venta, foto, marca, modelo o archivo en `UPLOADS_DIR`**.
- Si el job E2E de CI falla en «Install Playwright system dependencies» es la red de `apt` y no las pruebas: relanzar con `gh run rerun --failed`.

## Reservas

Flujo: en la ficha de un vehículo `DISPONIBLE`, un usuario con sesión pulsa «Reservar este vehículo» (sin sesión, el botón lleva a `/login?next=…` y vuelve a la ficha; la reserva siempre exige un clic). La acción crea la reserva en una transacción (solo una persona gana si dos reservan a la vez), deja el vehículo `RESERVADO` y lleva a `/mi-cuenta/reservas/<codigo>?nueva=1`, donde se muestra el código `RES-AAAA-XXXX` y el botón de WhatsApp con un mensaje que lleva código, vehículo y nombre (nunca placa ni documento). Las reservas del usuario están en `/mi-cuenta/reservas`. El cliente no cancela: esa acción es del personal (Fase 4).

- **Límites:** máximo 2 reservas activas por usuario (`PENDIENTE_CONTACTO` o `EN_NEGOCIACION`) y 10 intentos de reserva por hora por usuario.
- **Variable `RESERVA_EXPIRACION_HORAS`** (opcional): horas de vigencia; sin ella, 48; `0` desactiva la expiración. Un valor inválido impide arrancar el servidor.
- **Expiración:** `pnpm reservas:expirar` por `cron` (ver la sección siguiente).
- **Caché:** al reservar, la acción invalida la caché del catálogo con `updateTag` (el catálogo y la ficha lo muestran `RESERVADO` al instante). El script de expiración corre fuera del servidor y no puede invalidar la caché de Next: el listado y la ficha leen la BD en cada visita, y solo portada, filtros y vehículos similares tardan hasta que vence su caché (~60 s).
- **Pruebas:** `e2e/reservas.spec.ts` crea sus propios vehículos y usuarios temporales (dominio `@e2e-test.local`, color `E2E-RESERVAS-…`), no toca los vehículos del seed y los borra aunque falle; `e2e/global-setup.ts` barre restos de ejecuciones interrumpidas y falla si cambian los conteos de usuarios, vehículos o reservas.

## Expiración de Reservas

`pnpm reservas:expirar` (`scripts/expire-reservations.ts`) marca como `EXPIRADA` las reservas `PENDIENTE_CONTACTO` cuya `fechaExpiracion` ya pasó y devuelve el vehículo a `DISPONIBLE` si sigue `RESERVADO` y no tiene otra reserva activa. No toca reservas `EN_NEGOCIACION`, `COMPLETADA` ni `CANCELADA`, ni las que no tienen fecha de expiración. Es idempotente. Imprime una línea JSON (`{"expiradas":n,"vehiculosLiberados":m}`) y sale con código 1 si falla. Con `RESERVA_EXPIRACION_HORAS=0` (expiración desactivada) no hace nada.

Debe ejecutarse desde el directorio del proyecto (lee `DATABASE_URL` de `.env`) con un `cron` del servidor, por ejemplo cada 15 minutos (se configura en la Fase 6):

```cron
*/15 * * * * cd /ruta/al/proyecto && pnpm -s reservas:expirar >> /var/log/jds-reservas-expirar.log 2>&1
```

No existe una ruta HTTP para esto. Como el script corre en un proceso aparte, **no puede invalidar la caché de Next** (`updateTag`/`revalidateTag` solo funcionan dentro del servidor). Comprobado: el listado `/catalogo` y la ficha del vehículo leen la BD en cada visita y reflejan la expiración de inmediato; solo las consultas cacheadas (portada y filtros del catálogo, ~60 s; vehículos similares, perfil por defecto de 15 min) se ponen al día cuando vence su caché.

## Fotos de Vehículos

Las fotos se suben desde `/admin/vehiculos/[id]` y se guardan en el **disco del servidor** (decisión del demo; revisar antes de producción), no en un servicio externo. El esquema `vehiculo_fotos` guarda una URL, así que cambiar a otro almacenamiento solo toca `src/server/media/`. Las fotos del seed son URLs externas y siguen funcionando.

- **`UPLOADS_DIR`** (opcional): carpeta de subidas; por defecto `./uploads` (ignorada por git y **fuera de `public/`**). Debe existir con permisos de lectura y escritura **solo** para el usuario que ejecuta la app (por ejemplo `chmod 750`); los archivos se escriben con modo `640`. **Debe incluirse en las copias de seguridad** (Fase 6), junto con la base de datos: las filas apuntan a `/media/<uuid>.webp`.
- **Subida segura** (`POST /admin/vehiculos/[id]/fotos`, ruta y no Server Action porque estas limitan el cuerpo a 1 MB): solo personal con sesión y rol confirmados en la BD; origen comprobado; solo JPEG, PNG y WebP **verificados por la firma de bytes** (no por extensión ni `Content-Type`); máximo 5 MB por archivo, 10 por envío y 20 por vehículo; todo o nada. Cada imagen se **recodifica con `sharp` a WebP** (se eliminan EXIF y cualquier carga embebida; se aplica la orientación), con lado mayor de 1600 px y miniatura de 480 px. Los nombres son `crypto.randomUUID()` (`<uuid>.webp` y `<uuid>_t.webp`), nunca derivados del original.
- **Servicio** `GET /media/<uuid>.webp`: solo lectura; el nombre debe cumplir el patrón estricto y resolverse dentro de `UPLOADS_DIR` (`../`, `%2F`, mayúsculas, extensiones distintas o varios segmentos → 404); `Content-Type` fijo `image/webp`, `nosniff`, `Content-Security-Policy: default-src 'none'; sandbox` y caché larga `immutable` (los nombres no cambian).
- **Galería del panel:** subir, marcar la **principal** (siempre exactamente una; al eliminarla se promueve la siguiente), subir/bajar de posición y eliminar (borra la fila y los dos archivos). Cada cambio invalida la caché del catálogo.
- **Despliegue:** `sharp` va fijado a una versión exacta (usa binarios precompilados por plataforma: `pnpm install` en el servidor Oracle debe descargar el de su arquitectura). Detrás de un proxy inverso, permitir cuerpos de hasta ~55 MB en `/admin/vehiculos/*/fotos` (p. ej. `client_max_body_size 55m` en nginx).
- **Pruebas e2e:** el servidor de e2e usa `.e2e-uploads` como `UPLOADS_DIR`; las pruebas borran sus archivos y `e2e/global-setup.ts` falla si queda alguno.

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

## Accesibilidad y Rendimiento (F5-02)

**axe-core** (`@axe-core/playwright`, versión fija) corre en `e2e/accesibilidad.spec.ts`: una prueba por página principal —portada, catálogo con y sin filtros, ficha, próximamente, cómo funciona, contacto, login, registro, mi cuenta (perfil, seguridad, reservas, detalle) y todo el panel— en escritorio (1280 px) y móvil (360 px), con las reglas WCAG 2.1 A/AA. Falla con violaciones `serious`/`critical`; no hay excepciones. Al añadir una página, añádala a la lista del spec.

**Teclado** (`e2e/teclado.spec.ts`): menú de usuario, menú móvil y galería ampliada se operan con teclado, con foco visible, foco **atrapado** en el diálogo (`src/components/ui/useFocusTrap.ts`) y devuelto al origen al cerrar (Escape o botón); las confirmaciones de acciones del panel son `<details>` nativos; la subida de fotos se hace con teclado. `globals.css` anula animaciones y transiciones con `prefers-reduced-motion: reduce`.

**Un solo `banner` y un solo `main`.** Tras un inicio de sesión o cualquier navegación en el cliente, el DOM contiene un segundo `<header>`/`<main>`: es la ruta anterior que Next 16 conserva con `<Activity>` dentro de `<div style="display: none !important">` (hijo de `<body>`). Es inherente al framework (`node_modules/next/dist/docs/01-app/02-guides/preserving-ui-state.md`: «Activity keeps the DOM in the document (hidden with `display: none`)»), no depende de la sesión y queda **fuera del árbol de accesibilidad**. Las pruebas usan `getByRole` (que excluye lo oculto) y cuentan los landmarks no ocultos: deben ser 1 y 1.

**Rendimiento (Lighthouse móvil).** Con `pnpm build && pnpm start` y Chromium:

```bash
npx lighthouse@12 http://localhost:3000/catalogo --chrome-path=/usr/bin/chromium \
  --chrome-flags="--headless=new --no-sandbox" \
  --only-categories=performance,accessibility,best-practices,seo --output=json --output-path=./lh.json
```

Objetivo: Rendimiento ≥ 85, Accesibilidad ≥ 95, Buenas prácticas ≥ 95, SEO ≥ 95 en `/`, `/catalogo` y `/vehiculos/<id>` (cifras y excepciones en las notas de F5-02). No se añadió Lighthouse CI: el resultado en CI varía con la máquina compartida y no se pudo garantizar estabilidad; ejecute el comando antes de cada lanzamiento. Imágenes: `sizes` en `next/image`, `priority` solo en la primera tarjeta visible y la imagen principal de la ficha, miniaturas `_t.webp` en tarjetas y `alt` descriptivo («Marca Modelo Año - Foto N de M»).

## Páginas Legales, Cookies y Derechos del Titular (F5-04)

**Páginas legales.** `/privacidad` y `/terminos` leen su contenido de `src/lib/legal-content.ts` (título, fechas de vigencia y de última actualización, responsable y secciones). El texto lo aporta el propietario con asesoría legal (Ley 1581 de 2012): **no se inventa nada**. Mientras un documento sea `null`, esté incompleto o conserve un `TODO(owner)`, su ruta responde **404**, no se enlaza (pie, registro) y no entra al sitemap. Al publicarlo aparecen los enlaces en el pie y junto a la casilla de consentimiento del registro. La política muestra además la lista de cookies y, si el propietario aporta el correo (`siteContent.legal.rightsEmail`), el canal para ejercer los derechos.

**Cookies.** La aplicación solo usa cookies estrictamente necesarias (sesión de Auth.js, su token CSRF y la URL de retorno; ver `essentialCookies` en `src/lib/legal-content.ts`), por lo que no se requiere banner de consentimiento. `e2e/cookies.spec.ts` recorre el sitio como anónimo y como usuario y **falla si aparece cualquier otra cookie**: si se añade una (analítica, publicidad…), hay que revisar esta decisión y, en su caso, añadir el aviso de consentimiento.

**Pendientes del propietario.** Lista fechada en `ISSUES/PENDIENTES-PROPIETARIO.md`. Un test falla si aparece un `TODO(owner)` en un archivo que no esté listado allí.

### Derechos del titular: procedimiento manual (TODO(owner): validar con asesoría legal)

Mientras no exista una pantalla para ello, lo ejecuta un administrador con acceso a la base de datos, tras verificar la identidad de quien lo solicita y **dejando constancia** de la solicitud y la fecha. Haga antes un respaldo (`scripts/backup.sh`).

1. **Desactivar la cuenta** (panel, `/admin/usuarios`): impide iniciar sesión; no borra datos.
2. **Exportar (acceso/portabilidad).** Datos de la persona en `usuarios` (nombre, apellido, tipo y número de documento, correo, teléfono, ciudad, dirección, `consentimiento_datos_at`; **nunca** el `password_hash`), sus filas de `reservas` (`usuario_id`; incluye `whatsapp_link` y `observaciones`) y de `ventas` (`comprador_id`). Entregue el resultado a la persona por un canal verificado.
3. **Rectificar:** editar los datos en `usuarios`. Las ventas conservan su recibo.
4. **Suprimir.** Las claves foráneas son `RESTRICT`: **no se puede borrar** un usuario con reservas o ventas. Qué se conserva: las **ventas registradas** (recibo, precio, fecha, vehículo) por obligación contable y legal (`TODO(owner)`: confirmar plazos de conservación). Lo que se hace es **anonimizar** a la persona en `usuarios` (nombre y apellido a «Eliminado», documento y correo a valores únicos sin relación, p. ej. `eliminado-<id>`/`eliminado-<id>@invalido.test`, teléfono, ciudad y dirección a vacío, `activo = 0`, `password_hash` a un hash aleatorio) y vaciar `reservas.whatsapp_link` y `reservas.observaciones` de sus reservas. Si no tiene reservas ni ventas, se puede borrar la fila.
5. Los respaldos anteriores conservan los datos hasta que rote su retención (`BACKUP_RETENTION`); si hace falta, aplique el mismo procedimiento tras restaurar uno.

## Seguridad HTTP y Dependencias (F5-01)

Las cabeceras se definen en `src/server/security/headers.ts` y se aplican desde `next.config.ts` a todas las rutas (con pruebas unitarias y `e2e/seguridad-http.spec.ts`):

| Cabecera                                                                             | Para qué                                                                                                                                                                       |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Content-Security-Policy`                                                            | Solo recursos propios; imágenes también de `images.unsplash.com` (fotos del seed); sin `eval`; `object-src 'none'`, `base-uri`/`form-action 'self'`, `frame-ancestors 'none'`. |
| `Strict-Transport-Security` (1 año, `includeSubDomains`)                             | Solo en producción y si el proxy envía `X-Forwarded-Proto: https` (regla `has` de Next, sin pasar por el proxy de la app).                                                     |
| `Cross-Origin-Opener-Policy` / `Cross-Origin-Resource-Policy`                        | `same-origin`.                                                                                                                                                                 |
| `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` | Las básicas de siempre. `X-Powered-By` desactivada (`poweredByHeader: false`).                                                                                                 |

**Por qué la CSP no usa nonce.** La guía de CSP de Next 16 es explícita: un nonce obliga a renderizar **cada petición** y es incompatible con el prerenderizado parcial, es decir, volvería dinámicas todas las páginas públicas. Se midió: con la política en cabecera estática el resumen de `pnpm build` es idéntico al anterior (mismas rutas `○`/`◐`/`ƒ`). El coste, medido en el HTML real, es que Next inserta scripts en línea en cada página (arranque de React y datos RSC), que ni `'self'` ni un hash fijo pueden cubrir, así que `script-src` lleva `'unsafe-inline'`. Lo que sigue bloqueado: scripts de otros orígenes, `eval`, `<style>` en línea (solo se permiten atributos `style`, que escribe `next/image`), conexiones a otros orígenes, formularios hacia otros sitios, enmarcado y objetos. Zod se configura con `jitless` (`src/lib/validation/zod-setup.ts`) para que no intente `Function("")`, que el navegador registraría como violación. En desarrollo la política es `Report-Only` (y admite `eval`/estilos en línea que exige React en `next dev`).

**Ajustar la política.** Edite `buildCsp` (un origen nuevo se añade a la directiva que corresponda, nunca a `default-src`) y el test de `headers.test.ts` fallará si aparece `unsafe-eval`, un `unsafe-inline` fuera de `script-src`/`style-src-attr` o una directiva duplicada. Para endurecer `script-src` con nonce habría que aceptar que las páginas públicas pasen a ser dinámicas.

**Dependencias.** El CI ejecuta `pnpm audit --prod --audit-level high` (falla con `high`/`critical`) y `gitleaks` (v8.24.2 fijada con suma SHA-256, historial completo, configuración en `.gitleaks.toml`). Una excepción puntual se justifica con un `overrides` en `pnpm-workspace.yaml` que indique el aviso (GHSA) y la condición para retirarlo —así está `deepmerge-ts` para Prisma 6— o, si no hay parche, con una nota en el PR y aquí. Dependabot (`.github/dependabot.yml`) propone cada semana actualizaciones de `npm` y `github-actions`, agrupando minor/patch. `pnpm-lock.yaml` se instala con `--frozen-lockfile`. Revisión manual de dependencias sin uso: se retiraron `@typescript-eslint/eslint-plugin` y `@typescript-eslint/parser` (ya llegan con `eslint-config-next`); el resto tiene uso directo.

**Auth.js beta.** Fijada exactamente en `next-auth@5.0.0-beta.32` (sin `^`). Riesgo: es una versión beta sin garantías de estabilidad de API. Dependabot la ignora a propósito: se actualiza a mano, solo si (a) hay un aviso de seguridad que la afecte o (b) sale la versión estable 5.x, y siempre ejecutando `pnpm check`, `pnpm build` y `pnpm test:e2e`, que cubren login, sesión, roles y el proxy. `AUTH_SECRET` débil o ausente se rechaza al arrancar en producción (`instrumentation.ts`; reglas ampliadas en F5-03).

## Operación, Respaldos y Datos (F5-03)

### Validación de entorno

`src/server/env.ts` es la única definición de variables. Se ejecuta al arrancar (`instrumentation.ts`): en producción exige `AUTH_SECRET` de ≥32 caracteres y no trivial, `AUTH_TRUST_HOST=true`, `TRUST_PROXY=true`, `UPLOADS_DIR` absoluta y escribible, `NEXT_PUBLIC_SITE_URL` en `https` y `DATABASE_URL` `mysql://`. El mensaje nombra la variable y la regla, **nunca el valor**. Un test comprueba que `.env.example` y el esquema coinciden.

### Primer administrador

No hay usuarios demo en producción (`pnpm db:seed` solo crea los roles; `--demo` aborta en producción). Para crear el primer ADMIN:

```bash
ADMIN_NAME=… ADMIN_LASTNAME=… ADMIN_DOCUMENT_TYPE=CC ADMIN_DOCUMENT=… ADMIN_EMAIL=… ADMIN_PHONE=… pnpm admin:crear
```

La contraseña se pide por entrada oculta; `--password-from-env` la lee de `ADMIN_PASSWORD` (solo para automatizar). Aplica la política de contraseña y bcrypt coste 12; sale con código 2 si ya existe un ADMIN.

### Respaldos y restauración

- `scripts/backup.sh [--env-file ruta]`: `mysqldump --single-transaction --routines --triggers --events` comprimido + `tar` de `UPLOADS_DIR` + suma SHA-256, en `BACKUP_DIR` (por defecto `./backups`, carpeta `0700`, archivos `0600`). Conserva los últimos `BACKUP_RETENTION` (14). La contraseña nunca va en la línea de comandos (archivo de opciones temporal `0600`).
- `scripts/restore.sh AAAAMMDD-HHMMSS [--yes] [--env-file ruta]`: verifica las sumas, exige escribir `RESTAURAR`, restaura la BD y mueve las subidas actuales a `<UPLOADS_DIR>.antes-<fecha>`.
- `pnpm backup:verificar`: prueba el ciclo completo (respaldar → destruir → restaurar → comparar) en una BD **temporal** que se elimina al terminar; nunca toca la BD de desarrollo. `DB_CLIENT_SSL=off` desactiva TLS del cliente (solo para BD local).
- Programación con `cron` (se instala en la Fase 6):

```cron
15 3 * * *  cd /srv/jds-vehiculos && ./scripts/backup.sh --env-file /etc/jds/env >> /var/log/jds-backup.log 2>&1
```

Copie los respaldos fuera del servidor; un respaldo en el mismo disco no protege contra su pérdida.

### Salud

`GET /api/health` (BD, carpeta de subidas escribible, espacio libre ≥ `HEALTH_MIN_FREE_MB`, 200 por defecto 200 MB): responde `200`/`503` con `{status,db,uploads,disk}` y `Cache-Control: no-store`, sin versiones, rutas ni mensajes internos. `GET /api/health/live` solo confirma que el proceso responde (para el reinicio automático).

### Registro de eventos

`logEvent({ channel, level, … })` (`src/server/log.ts`) escribe una línea JSON en stdout para seguridad, panel, reservas y errores. `LOG_LEVEL` (`debug|info|warn|error`, por defecto `info`). Redacta claves sensibles (contraseñas, tokens, cookies…). La rotación se configura en el servidor (`logrotate` o el journal de systemd, Fase 6).

### Migraciones e índices

En producción solo `pnpm db:migrar` (`prisma migrate deploy`); nunca `migrate dev` ni `db push`. `pnpm db:verificar` falla si `schema.prisma` y las migraciones divergen (corre en CI). `scripts/explain-volumen.sh` carga un volumen sintético en una BD temporal y ejecuta `scripts/sql/explain-queries.sql` para revisar planes con `EXPLAIN`.

## Seguridad (resumen y reglas del proyecto)

Detalle por tema: «Panel» (roles y barreras), «Seguridad HTTP y Dependencias» (cabeceras, CSP, audit, gitleaks), «Páginas Legales» (cookies) y «Operación» (más abajo).

**Pruebas que protegen las reglas** (fallan si alguien añade una ruta o acción sin cuidado):

- `src/server/security/route-audit.test.ts`: toda `page.tsx`/`route.ts` de `(admin)` y `(account)` y **toda Server Action** (`'use server'`, función a función) debe llamar a su guardia: `requireStaff`/`requireAdmin` en el panel; `requireUser` o `getFreshUser` en la cuenta; las acciones públicas por diseño (login, registro, cierre de sesión) están en una lista blanca con su justificación, y una entrada obsoleta también falla. Quitar `requireStaff()` de cualquier página o acción del panel rompe el test. Un `authorize()` local sirve solo si la acción lo llama.
- Mismo archivo: nada de `Object.fromEntries(formData)`, `data: formData|body|payload` ni `...body` hacia Prisma: las acciones leen **campos explícitos** validados con Zod.
- **Mapa de rutas `docs/RUTAS.md`** (generado con `pnpm rutas`): lista cada página, ruta HTTP y Server Action con su acceso. El test falla si el archivo y el código divergen; al añadir una ruta se regenera y se revisa la columna «Acceso».
- Cobertura: `pnpm test:coverage` (v8, `src/server` y `src/lib`) con umbrales en `vitest.config.mts` (sentencias 95, ramas 89, funciones 96, líneas 96) que **no se bajan**; el CI publica la tabla en el resumen del job y el informe HTML como artefacto `coverage`.

**Limitadores de intentos** (`src/server/security/limiters.ts`, probados en `limiters.test.ts`):

| Acción                                    | Política                                                        |
| ----------------------------------------- | --------------------------------------------------------------- |
| Inicio de sesión                          | 5 fallos por correo+IP y 20 por IP, en 15 min                   |
| Registro                                  | 5 intentos por IP y hora                                        |
| Cambio de contraseña                      | 5 fallos de la clave actual por usuario en 15 min               |
| Reservas                                  | 10 intentos por usuario y hora                                  |
| Restablecer clave de otra persona (ADMIN) | 10 por administrador y hora                                     |
| Subida de fotos (panel)                   | 30 envíos por persona y hora (cada envío admite hasta 10 fotos) |

**Instancia única (decisión).** Los limitadores viven **en memoria del proceso** y el proxy no comparte estado: son válidos solo con **una sola instancia** de Node. La Fase 6 despliega **una instancia**. Con varias habría que moverlos a la base de datos o a un almacén compartido (limitador distribuido, Fase 7); hasta entonces, no escalar horizontalmente. Un reinicio vacía los contadores.

**Riesgos residuales a revisar antes de producción**

- **CSP con `'unsafe-inline'` en `script-src`** (decisión aceptada en F5-01): una CSP estricta con nonce volvería dinámicas todas las páginas públicas. Un XSS que inyectara un script en línea no lo bloquearía la CSP; siguen cerradas las cargas de scripts externos, `eval`, `<style>` en línea, formularios y conexiones a otros orígenes y el enmarcado. Mitigaciones: React escapa todo el texto, no se usa `dangerouslySetInnerHTML` con datos de usuarios y cada campo se valida. Revisar si el volumen de datos de usuario en páginas públicas crece.
- **HSTS y modo IP:** la aplicación envía `Strict-Transport-Security` cuando el proxy indica `X-Forwarded-Proto: https`. Con IP y certificado autofirmado **debe estar desactivado** (un navegador que lo recuerde no podría entrar si cambia el certificado): lo neutraliza el proxy en F6-03 (quitar la cabecera o hacer `HSTS=on|off`).
- **JWT de 7 días no revocable:** el proxy decide por rol del token; páginas y acciones confirman rol y cuenta activa en la BD en cada petición.
- **Auth.js `5.0.0-beta.32`** fijada exacta (ver «Seguridad HTTP y Dependencias»).
- **Limitadores en memoria** (arriba).

## Operación (resumen)

- **Una sola instancia** de la aplicación (ver «Seguridad»). Salud: `/api/health` y `/api/health/live`. Registro: líneas JSON en stdout (`LOG_LEVEL`).
- **Antes de desplegar**: `pnpm check`, `pnpm build`, `pnpm test:e2e`, `pnpm test:coverage`, `pnpm audit --prod` y, si cambió una ruta, `pnpm rutas`. En producción solo `prisma migrate deploy` (`pnpm db:migrar`); `pnpm db:verificar` confirma que el esquema y las migraciones coinciden.
- **Primer administrador**: `pnpm admin:crear` (sin usuarios demo en producción).
- **Datos**: respaldo diario de la BD y de `UPLOADS_DIR` (`scripts/backup.sh`, retención `BACKUP_RETENTION`), restauración con `scripts/restore.sh`, ciclo comprobable con `pnpm backup:verificar`. Copiar los respaldos fuera del servidor.
- **Decisiones del propietario** pendientes: `ISSUES/PENDIENTES-PROPIETARIO.md` y la matriz de `ISSUES/README.md`.
- Detalle en «Operación, Respaldos y Datos (F5-03)» y «Checklist de Despliegue».

## Gestión del Proyecto

El desarrollo se gestiona a través del backlog de tareas ubicado en la carpeta [ISSUES/](ISSUES/README.md). Consulta dicho archivo para conocer el flujo de trabajo, convenciones y el estado de cada fase.

> [!NOTE]
> El pipeline de despliegue continuo (CD) hacia el servidor en Oracle Cloud vía SSH será implementado en la **Fase 6** del proyecto.
