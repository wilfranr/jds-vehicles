# ISSUES: JDS Vehículos

Backlog de trabajo gestionado por el **orquestador**. Cada issue es autocontenido: otro agente debe poder desarrollarlo leyendo solo ese archivo más los documentos de referencia.

## Decisiones de proyecto (vinculantes)

| Tema               | Decisión                                                                                                                                           |
| :----------------- | :------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework          | Next.js (App Router) + TypeScript estricto                                                                                                         |
| ORM / BD           | Prisma + MySQL 8.0+                                                                                                                                |
| Auth (Fase 2)      | Auth.js                                                                                                                                            |
| Estilos            | Tailwind CSS con los tokens de `DESIGN.md`                                                                                                         |
| Gestor de paquetes | pnpm                                                                                                                                               |
| Hosting            | Servidor propio en Oracle Cloud, acceso por SSH (despliegue en Fase 6)                                                                             |
| Idioma             | UI y contenido en español; código (identificadores) en inglés salvo nombres de tablas/columnas, que se conservan en español como en `database.sql` |

## Documentos de referencia

- `docs/DOCUMENTACION.md`: reglas de negocio, ERD, diccionario de datos.
- `docs/legacy/database.sql`: esquema original MySQL (fuente de verdad del modelo).
- `docs/DESIGN.md`: sistema de diseño "Velocita Motors" (colores, tipografía, componentes).
- `docs/prototype/code.html` + `docs/prototype/screen.png`: prototipo visual (Tailwind por CDN, contenido de ejemplo).

## Flujo de trabajo para el agente desarrollador

1. Toma un issue cuyo estado sea `TODO` y cuyas dependencias estén en `DONE`.
2. Cambia su `Estado` a `IN PROGRESS` en el archivo.
3. Trabaja en una rama `issue/<ID>-<slug>` (ej. `issue/F0-02-scaffold-nextjs`) y abre un pull request hacia `main`. **No se hace commit directo a `main`.**
4. Cumple **todos** los criterios de aceptación y ejecuta los comandos de verificación.
5. Cambia `Estado` a `REVIEW` (**nunca a `DONE`**), y añade al final una sección `## Notas de entrega` con: qué se hizo, desviaciones respecto al issue y comandos para verificar.
6. Solo el orquestador revisa, aprueba y marca `DONE`; el merge a `main` se hace después de esa revisión.
7. Antes de escribir código con Next.js, leer `AGENTS.md` y la documentación local en `node_modules/next/dist/docs/`.

No ampliar el alcance: si surge trabajo extra, anótalo en `Notas de entrega` para que el orquestador cree un issue nuevo.

## Convención de IDs

`F<fase>-<nn>`: por ejemplo `F0-03`. Un archivo por issue: `F0-03-nombre.md`.

## Índice

### Fase 0: Cimientos

| ID                                       | Título                                           | Depende de   | Estado |
| :--------------------------------------- | :----------------------------------------------- | :----------- | :----- |
| [F0-01](F0-01-repo-init.md)              | Inicializar repositorio, README y `.env.example` | —            | DONE   |
| [F0-02](F0-02-scaffold-nextjs.md)        | Scaffold Next.js + TypeScript + estructura       | F0-01        | DONE   |
| [F0-03](F0-03-tailwind-design-tokens.md) | Tailwind: tokens de diseño y fuente              | F0-02        | DONE   |
| [F0-04](F0-04-prisma-mysql-schema.md)    | MySQL local (Docker) + Prisma + migración base   | F0-02        | DONE   |
| [F0-05](F0-05-seed-script.md)            | Script de seed independiente                     | F0-04        | DONE   |
| [F0-06](F0-06-quality-tooling.md)        | ESLint, Prettier, typecheck y Vitest             | F0-02        | DONE   |
| [F0-07](F0-07-ci-pipeline.md)            | Pipeline de CI mínimo                            | F0-04, F0-06 | DONE   |
| [F0-08](F0-08-cierre-fase0.md)           | Cierre de Fase 0 (ajustes de revisión)           | F0-07        | DONE   |

Orden sugerido: F0-01 → F0-02 → (F0-03, F0-04, F0-06 en paralelo) → F0-05 → F0-07 → F0-08.

### Fase 1: Catálogo público

| ID                                      | Título                                          | Depende de   | Estado |
| :-------------------------------------- | :---------------------------------------------- | :----------- | :----- |
| [F1-01](F1-01-layout-base.md)           | Layout base: header, footer y botón de WhatsApp | F0-08        | DONE   |
| [F1-02](F1-02-capa-datos-catalogo.md)   | Capa de datos del catálogo                      | F0-08        | DONE   |
| [F1-03](F1-03-listado-catalogo.md)      | Portada y listado de catálogo con filtros       | F1-01, F1-02 | DONE   |
| [F1-04](F1-04-detalle-vehiculo.md)      | Detalle de vehículo con galería                 | F1-02, F1-03 | DONE   |
| [F1-05](F1-05-paginas-informativas.md)  | Próximamente, Cómo funciona y Contacto          | F1-01, F1-03 | DONE   |
| [F1-06](F1-06-seo-calidad-fase1.md)     | SEO básico, errores y pruebas de cierre         | F1-03–F1-05  | DONE   |
| [F1-07](F1-07-correcciones-revision.md) | Correcciones de la revisión de F1-01 y F1-02    | F1-02        | DONE   |

Orden sugerido: F0-08 → (F1-01 ∥ F1-02) → F1-03 → (F1-04 ∥ F1-05) → F1-06.

### Fase 2: Autenticación

| ID                                        | Título                                           | Depende de          | Estado |
| :---------------------------------------- | :----------------------------------------------- | :------------------ | :----- |
| [F2-01](F2-01-authjs-base.md)             | Auth.js: configuración base, sesiones y helpers  | F1-07               | DONE   |
| [F2-02](F2-02-registro.md)                | Registro de clientes                             | F2-01               | DONE   |
| [F2-03](F2-03-login-logout-ui.md)         | Login, cierre de sesión y menú de usuario        | F2-01, F2-02, F1-06 | DONE   |
| [F2-04](F2-04-seguridad-rutas-limites.md) | Protección de rutas y limitación de intentos     | F2-01               | DONE   |
| [F2-05](F2-05-mi-cuenta.md)               | Mi cuenta (perfil y cambio de contraseña)        | F2-03, F2-04        | DONE   |
| [F2-06](F2-06-e2e-auth.md)                | Pruebas e2e de autenticación y cierre de Fase 2  | F2-05, F1-06        | DONE   |
| [F2-07](F2-07-limitador-registro.md)      | Integrar el limitador de intentos en el registro | F2-02, F2-04        | DONE   |

Orden sugerido: F2-01 → (F2-02 ∥ F2-04) → (F2-03 ∥ F2-07) → F2-05 → F2-06.
F1-06 y las issues F2-01, F2-02 y F2-04 se pueden trabajar en paralelo: no comparten archivos relevantes.

### Fase 3: Reservas y WhatsApp

| ID                                    | Título                                            | Depende de          | Estado |
| :------------------------------------ | :------------------------------------------------ | :------------------ | :----- |
| [F3-01](F3-01-servicio-reservas.md)   | Servicio de reservas (transacción y concurrencia) | F2-05               | DONE   |
| [F3-02](F3-02-reservar-whatsapp.md)   | Reservar desde el detalle y abrir WhatsApp        | F3-01               | DONE   |
| [F3-03](F3-03-mis-reservas.md)        | Mis reservas y confirmación                       | F3-01               | DONE   |
| [F3-04](F3-04-expiracion-reservas.md) | Expiración de reservas                            | F3-01               | DONE   |
| [F3-05](F3-05-e2e-reservas.md)        | Pruebas e2e de reservas y cierre de la Fase 3     | F3-02, F3-03, F3-04 | DONE   |

Orden sugerido: F3-01 → (F3-02 ∥ F3-03 ∥ F3-04) → F3-05. F3-02 enlaza a la página de F3-03; si se hacen en paralelo, coordinar la ruta `/mi-cuenta/reservas/[codigo]`.

### Reglas de contenido (vinculantes)

- Todo texto editorial o comercial de la interfaz (títulos, subtítulos, cifras, tarjetas de beneficios, garantías, certificaciones, plazos) vive en `src/lib/site-content.ts`, nunca escrito directamente en páginas o componentes.
- Solo se publican afirmaciones comerciales que estén en `docs/` o que el propietario haya aprobado (las cifras provisionales del prototipo están aprobadas como provisionales). Lo demás se deja fuera, con un texto neutro, o se marca con `TODO(owner)` y no se muestra.
- Si falta un dato (dirección, horario, razón social, textos legales), no se inventa: se oculta.

### Decisiones pendientes del propietario

- **Cifras de marca** ("42 vehículos", "100 % garantía", "48 h", "inspección de 120 puntos"): se usan provisionalmente tal como están en el prototipo, centralizadas en `src/lib/site-content.ts`. Confirmar o reemplazar antes de publicar (Fase 6).
- **Almacenamiento de fotos** (disco del servidor Oracle vs. servicio externo): se decide antes de la Fase 4. En la Fase 1 las fotos se muestran desde URL.
- Dirección, horario y mapa del concesionario: no se muestran hasta que existan.
- **Política de tratamiento de datos personales** (y términos del servicio): el registro (F2-02) recoge documento de identidad, teléfono y dirección, y guarda la fecha de aceptación. El texto legal definitivo debe aportarlo el propietario (probablemente exigido por la Ley 1581 de 2012; confirmar con asesoría legal). Hasta entonces, texto neutro con `TODO(owner)`.
- **Proveedor de correo para recuperar contraseñas** (SMTP propio, servicio transaccional, etc.): sin él no se puede implementar "¿Olvidaste tu contraseña?". No se incluye en la Fase 2; se crea el issue cuando se decida. Mientras tanto, un administrador puede restablecer contraseñas (Fase 4).

- **Reservas (Fase 3), decididas por delegación del propietario para el demo; confirmar antes de producción:** (a) plazo de expiración de una reserva: **48 horas** (`RESERVA_EXPIRACION_HORAS`, `0` = sin expiración); (b) tope de reservas activas por usuario: **2**; (c) el cliente **no** cancela su reserva (la documentación solo da esa acción al personal; llega en la Fase 4).

### Fases siguientes

Fase 4 (panel de administración): pendiente de crear (la Fase 3 está en `DONE`).
