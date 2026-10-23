# F4-08: Pruebas e2e del panel y cierre de la Fase 4

- **Estado:** REVIEW
- **Fase:** 4
- **Depende de:** F4-02, F4-03, F4-04, F4-05, F4-06, F4-07
- **Prioridad:** Alta

## Contexto

Cierra la Fase 4 con pruebas de punta a punta (patrón de `e2e/reservas.spec.ts`: datos propios por prueba, limpieza garantizada, `getByRole('main')`/`getByRole('banner')`) y una revisión transversal de autorización.

## Alcance

1. Flujo del personal: ASESOR crea un vehículo (con fotos) → aparece en el catálogo → un cliente lo reserva → el ASESOR la pasa a negociación → registra la venta → el vehículo desaparece del catálogo y la ficha pública da 404.
2. Cancelación: el vehículo vuelve a `DISPONIBLE` y el catálogo lo muestra.
3. **Matriz de autorización**: para cada ruta y acción de `/admin` comprobar anónimo (login), CLIENTE (404), ASESOR y ADMIN (permitido o 404 según el rol mínimo). Intentar las Server Actions de usuarios y configuración con un ASESOR debe fallar sin efectos.
4. Usuarios: ADMIN restablece la clave de un cliente de prueba y este entra con la temporal; las salvaguardas del último ADMIN.
5. Fotos: subir un archivo falso (.jpg que no lo es) se rechaza.
6. Revisión: ninguna página del panel es indexable; todas llevan `noindex`; el `sitemap` no las lista.
7. Datos de prueba propios, borrados aunque falle; `global-setup` verifica que no quedan residuos (usuarios, vehículos, fotos en `UPLOADS_DIR`, reservas, ventas).
8. README: sección "Panel" completa (roles, flujos, `UPLOADS_DIR`); actualizar `ISSUES/README.md` con las decisiones por confirmar antes de producción (permisos de ASESOR, almacenamiento en disco).

## Criterios de aceptación

- [x] Las pruebas pasan en local (CI: ver el PR) y no dejan residuos.
- [x] `pnpm check`, `pnpm build` y `pnpm test:e2e` pasan en local; CI: ver el PR.

## Recordatorio de proceso

Rama `issue/<ID>-<slug>` **creada desde `main` actualizado** (`git checkout main && git pull`), nunca encadenada sobre otra rama sin fusionar; si dependes de un issue que aún no está en `main`, espera. PR al terminar y estado `REVIEW`. **No fusionar ni marcar `DONE`.** Texto visible en `site-content.ts`, sin afirmaciones comerciales inventadas. **Lee `AGENTS.md` y la documentación local de Next antes de escribir código.**

## Observaciones de la revisión de F4-02, F4-03, F4-06 y F4-07 (añadidas por el orquestador)

- Las pruebas e2e comparten una sola BD y un catálogo global: ninguna prueba debe abrir «la primera tarjeta» ni contar filas globales; cada prueba filtra por su propio dato temporal (color `E2E-…`, correo `@e2e-test.local`) o usa un vehículo del seed por id. Las pruebas que usan la BD real en vitest se llaman `*.db.test.ts` y corren en serie.
- El job E2E del CI puede fallar sin que fallen las pruebas por la red de `apt` en «Install Playwright system dependencies» (el espejo de Ubuntu a veces baja a pocos KB/s). Si se repite, evaluar ejecutar el job en el contenedor oficial de Playwright (`mcr.microsoft.com/playwright`), que ya trae las bibliotecas.
- Un cambio de rol solo lo ve el proxy cuando la persona vuelve a iniciar sesión (el JWT no se revoca); las páginas del panel sí confirman el rol vigente en la BD. Incluir en la matriz de autorización una prueba de un usuario degradado con sesión vigente.

## Notas de entrega

Rama desde `main` actualizado (sin encadenar). Solo añade pruebas, utilidades de prueba, la ampliación de `global-setup`, una línea de `robots.txt` y documentación.

### Qué se hizo

**Utilidades** (`e2e/helpers.ts`): `TestData` crea los datos propios de cada prueba (usuarios `@e2e-test.local`, vehículos de color `E2E-RESERVAS-…`) y su `cleanup()` borra, aunque la prueba falle, **los archivos de fotos de `UPLOADS_DIR`**, las ventas, las reservas, los vehículos y los usuarios; `sessionFor` (inicio de sesión por la interfaz con IP propia), `captureBlocked`/`replay` (ver la matriz) y fixtures de imágenes generadas con `sharp`.

**Pruebas nuevas (18 e2e; en total 81):**

1. `e2e/admin-flujo.spec.ts` (2): **flujo completo** — el ASESOR crea un vehículo por la interfaz, un archivo falso `.jpg` (PHP) se rechaza y se suben 2 fotos reales → aparece en `/catalogo` (filtrado por su color único) con su foto subida → un cliente lo reserva desde la ficha → el ASESOR lo encuentra por el correo del cliente, lo pasa a negociación y **registra la venta** → desaparece del catálogo, la ficha pública da «Vehículo no encontrado», el cliente ve su reserva `Completada` y la BD tiene comprador = cliente, vendedor = ASESOR, vehículo `VENDIDO` y oculto. **Cancelación** — el cliente reserva (el catálogo muestra `RESERVADO`), el ASESOR cancela con motivo, el vehículo vuelve a `DISPONIBLE`, el catálogo ya no lo marca reservado y la ficha vuelve a ofrecer reservar.
2. `e2e/admin-autorizacion.spec.ts` (4): **matriz de autorización** de las 11 rutas del panel (incluidas las de detalle con datos propios) × 4 perfiles — anónimo → 307 a `/login?next=<ruta>`; `CLIENTE` → 404; `ASESOR` → 200 o 404 en usuarios y configuración; `ADMIN` → 200 —, la subida de fotos (anónimo → login, `CLIENTE` rechazado y sin filas) y códigos/recibos mal formados («no encontrado»). **Server Actions de usuarios por replay:** se captura (abortando la petición, sin que llegue al servidor) la petición real que envía el navegador del ADMIN al cambiar un rol y al restablecer una clave, y se **reenvía** con las sesiones de ASESOR, CLIENTE, anónimo y de un **ADMIN degradado a ASESOR en la BD con la sesión aún vigente**: ningún efecto (rol y hash intactos). **Control** que valida el método: el mismo replay con la sesión del ADMIN sí cambia el rol y la clave. **Usuario degradado o desactivado con sesión vigente:** pierde el acceso a `/admin`, reservas, ventas, vehículos y usuarios de inmediato (la BD manda sobre el token), y un ADMIN degradado a ASESOR conserva las páginas de personal pero no las de ADMIN.
3. `e2e/admin-configuracion.spec.ts` (+1): replay de la acción de **guardar configuración** (dentro del archivo serial para no pisar la configuración global): ASESOR, CLIENTE, anónimo y ADMIN degradado no cambian `instagram_url`; control con el ADMIN sí; los valores se restauran por la interfaz.
4. `e2e/admin-indexacion.spec.ts` (2): las **11 rutas del panel** llevan exactamente un `meta robots` con `noindex, nofollow`; el sitemap no lista `/admin`, `/mi-cuenta`, `/login`, `/registro` ni `/media`; `robots.txt` excluye `/admin`, `/mi-cuenta` y `/api` (se añadieron `/admin` y `/mi-cuenta` a `src/app/robots.ts`, defensa en profundidad además del `noindex`).
5. `global-setup.ts` ampliado: **antes de barrer cuenta lo marcado** (usuarios, vehículos, reservas, ventas, fotos, marcas y modelos con prefijo) y falla si no es cero; después compara los totales globales de usuarios, vehículos, reservas, **ventas, fotos, marcas y modelos** y los **archivos de `UPLOADS_DIR`**. El barrido borra primero las ventas (FK `RESTRICT`).

Ya cubiertos por los e2e de cada módulo (F4-02 … F4-07): doble envío y cancelaciones simultáneas, reset de contraseña con la temporal, fotos hostiles (texto como `.jpg`, +5 MB, dañado, 11 archivos, EXIF) y `/media` con traversal.

**Resultado:** `pnpm check` **627** pruebas, `pnpm build` en verde y sin avisos, `pnpm test:e2e` **81 de 81 en 5 ejecuciones seguidas** (1,4 min cada una). Tras las ejecuciones la BD está como el seed (2 usuarios, 3 vehículos, 0 reservas y 0 ventas, 3 fotos y 3 marcas del seed, configuración original) y `.e2e-uploads` no existe.

### Hallazgos del replay de Server Actions (útiles para el criterio de seguridad)

- Un reenvío con ASESOR o CLIENTE recibe **409 «Server Action unavailable»**: Next reenvía la acción a la página que la define (`/admin/usuarios`) con las mismas cookies y es **el proxy** quien la frena. La segunda barrera (la propia acción, `requireAdmin()` contra la BD) se ejercita con el **ADMIN degradado**: el proxy lo deja pasar (el token aún dice ADMIN) y es la acción quien lo rechaza sin efecto. Las pruebas unitarias de cada acción comprueban además que `requireAdmin()` se evalúa antes que cualquier escritura.
- Una acción abortada deja la cola de acciones de esa página sin resolver; por eso el test recarga entre capturas.

### Decisiones por confirmar antes de producción

Quedan también en `ISSUES/README.md` («Decisiones pendientes del propietario»):

1. **Permisos:** ASESOR gestiona reservas, ventas e inventario; solo ADMIN gestiona usuarios y configuración.
2. **Ventas:** sin edición, anulación ni borrado desde el panel.
3. **Reservas (Fase 3):** expiración de 48 h (`RESERVA_EXPIRACION_HORAS`, `0` = sin expiración), tope de 2 reservas activas por usuario y el cliente no cancela su reserva.
4. **Almacenamiento de fotos en disco** y todo lo que implica (sección siguiente).
5. **Cambios de rol:** el proxy los ve al volver a iniciar sesión (el JWT no se revoca); páginas y acciones del panel consultan la BD siempre.
6. **Formato de placa** amplio (5–10 alfanuméricos) y unicidad solo entre vehículos no vendidos.
7. **Recuperación de contraseña** por el administrador (sin proveedor de correo) con clave temporal comunicada por un canal seguro.
8. **Fuera de esta fase y siguen pendientes del propietario:** cifras de marca provisionales, texto legal de tratamiento de datos (Ley 1581 de 2012), dirección/horario/mapa.

### Puntos «A revisar» de #49 (fotos) y #50 (ventas)

1. **Permisos de la carpeta de fotos:** crear `UPLOADS_DIR` (por defecto `./uploads`, fuera de `public/`) con lectura y escritura solo para el usuario que ejecuta la app (p. ej. `chmod 750`); los archivos se escriben con modo `640`.
2. **Copia de seguridad:** incluir esa carpeta junto con la BD (las filas apuntan a `/media/<uuid>.webp`); restaurar solo una de las dos deja fotos rotas. A definir en la Fase 6.
3. **Cuerpo de ~55 MB en el proxy inverso:** la subida admite hasta 10 archivos de 5 MB (~51 MB); en nginx, `client_max_body_size 55m` para `/admin/vehiculos/*/fotos`. Sin eso el proxy corta antes de que la app pueda mostrar su mensaje claro.
4. **Purga de huérfanos:** si un vehículo se borra por SQL, sus filas de fotos caen por cascada pero los archivos quedan en disco (el panel no borra vehículos, así que solo ocurre por intervención manual). Un script de limpieza (archivos sin fila) sería un issue futuro.
5. **Exclusión mutua en `roles`:** el consecutivo de recibos se serializa con una fila fija de `roles` (la última; la de placas es la primera), con orden de bloqueos fijo mutex → reserva → vehículo. Suficiente para el volumen esperado; con mucho volumen convendría una tabla de secuencias (migración).

Otros ya conocidos: estado HTTP 200 con contenido «no encontrado» cuando la denegación ocurre dentro de la página en streaming (el proxy sí da 404 reales en los casos que decide con el JWT); POST de un CLIENTE a la ruta de subida responde 400 (nunca se acepta); sigue en los logs del servidor de producción el aviso `crypto.getRandomValues()` de Auth.js (F2-06).

### Para revisar

- **Último ADMIN en e2e:** su salvaguarda (incluidas las carreras de dos administradores) está cubierta con la BD en `users.db.test.ts`; en e2e solo se comprueba que un ADMIN no puede quitarse el rol a sí mismo, porque probar «el único ADMIN» exigiría tocar al administrador del seed o contar filas globales (justo lo que esta fase evita).
- **CI en contenedor de Playwright:** no se cambió (sugerencia de la revisión); el reintento robusto de `apt` de #47 sigue vigente. Si el E2E de CI falla en «Install Playwright system dependencies», es la red: `gh run rerun --failed`.

**Cómo verificar**: `pnpm db:seed && pnpm check && pnpm build && pnpm test:e2e` (repetir varias veces) y comprobar que la BD queda como el seed y que `.e2e-uploads` no existe.
