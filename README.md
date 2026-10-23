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

## Gestión del Proyecto

El desarrollo se gestiona a través del backlog de tareas ubicado en la carpeta [ISSUES/](ISSUES/README.md). Consulta dicho archivo para conocer el flujo de trabajo, convenciones y el estado de cada fase.

> [!NOTE]
> El pipeline de despliegue continuo (CD) hacia el servidor en Oracle Cloud vía SSH será implementado en la **Fase 6** del proyecto.
