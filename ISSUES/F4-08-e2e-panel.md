# F4-08: Pruebas e2e del panel y cierre de la Fase 4

- **Estado:** TODO
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

- [ ] Las pruebas pasan en local y en CI, y no dejan residuos.
- [ ] `pnpm check`, `pnpm build` y `pnpm test:e2e` pasan; CI en verde.

## Recordatorio de proceso

Rama `issue/<ID>-<slug>` **creada desde `main` actualizado** (`git checkout main && git pull`), nunca encadenada sobre otra rama sin fusionar; si dependes de un issue que aún no está en `main`, espera. PR al terminar y estado `REVIEW`. **No fusionar ni marcar `DONE`.** Texto visible en `site-content.ts`, sin afirmaciones comerciales inventadas. **Lee `AGENTS.md` y la documentación local de Next antes de escribir código.**

## Observaciones de la revisión de F4-02, F4-03, F4-06 y F4-07 (añadidas por el orquestador)

- Las pruebas e2e comparten una sola BD y un catálogo global: ninguna prueba debe abrir «la primera tarjeta» ni contar filas globales; cada prueba filtra por su propio dato temporal (color `E2E-…`, correo `@e2e-test.local`) o usa un vehículo del seed por id. Las pruebas que usan la BD real en vitest se llaman `*.db.test.ts` y corren en serie.
- El job E2E del CI puede fallar sin que fallen las pruebas por la red de `apt` en «Install Playwright system dependencies» (el espejo de Ubuntu a veces baja a pocos KB/s). Si se repite, evaluar ejecutar el job en el contenedor oficial de Playwright (`mcr.microsoft.com/playwright`), que ya trae las bibliotecas.
- Un cambio de rol solo lo ve el proxy cuando la persona vuelve a iniciar sesión (el JWT no se revoca); las páginas del panel sí confirman el rol vigente en la BD. Incluir en la matriz de autorización una prueba de un usuario degradado con sesión vigente.
