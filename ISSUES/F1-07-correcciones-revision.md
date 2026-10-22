# F1-07: Correcciones de la revisión de F1-01 y F1-02

- **Estado:** REVIEW
- **Fase:** 1
- **Depende de:** F1-02
- **Prioridad:** Alta (hacer antes de F1-03; los puntos 1–2 pueden ir en paralelo con F1-03 si no tocan los mismos archivos)

## Contexto

Revisión del orquestador. F1-01 se fusionó (#3) y se marcó `DONE` sin pasar por revisión; al revisarla después se hallaron los puntos 1–3. F1-02 (#4) se aprobó y fusionó, con el punto 4 pendiente. Todo lo demás funciona (`pnpm check` y `pnpm build` pasan en ambos).

## Alcance

1. **Contenido inventado en `src/lib/site-content.ts`.** El issue F1-01 pedía solo las cifras del prototipo; se añadieron datos que nadie confirmó:
   - `legalName: 'JDS Vehículos S.A. de C.V.'`: razón social inventada (y "S.A. de C.V." es una forma societaria mexicana; el negocio es colombiano). **Eliminar** del contenido y del footer. Si el footer necesita línea legal, usar solo `© <año> JDS Vehículos. Todos los derechos reservados.` con el año dinámico.
   - `heroTag: 'Showroom Certificado JDS Vehículos 2025'`: año fijo. Quitar el año (`'Showroom Certificado JDS Vehículos'`) y marcar `TODO(owner)` como provisional junto con las demás afirmaciones de certificación.
   - `platformBadge: 'Plataforma Digital Certificada'` y `shortDescription` ("coleccionistas exigentes"): no vienen del prototipo ni del propietario. Sustituir por texto neutro y verificable (ej. "Concesionario de vehículos nuevos y seminuevos") o eliminarlos si no se usan.
2. **Enlaces rotos en el footer.** `/terminos-condiciones`, `/privacidad` y `/certificacion` devuelven 404 (comprobado con `next start`). No crear esas páginas ahora: quitar los tres enlaces de `footerLinks`, con `TODO(owner)` para reponerlos cuando existan los textos legales. Los enlaces de la navegación principal (`/catalogo`, `/proximamente`, `/como-funciona`, `/contacto`) se quedan: los crean F1-03 y F1-05.
3. **`getDealerConfig()` cachea el valor de respaldo cuando la BD falla** (`src/server/config.ts`). Con `'use cache'`, si la base está caída en el primer render, el respaldo queda cacheado hasta que expire. Ajustar para que un fallo no se cachee (por ejemplo, separar la lectura de BD en una función cacheada que lance el error y capturarlo fuera, o usar un `cacheLife` corto en el camino de error; seguir lo que documente `node_modules/next/dist/docs/`). Añadir un test que simule el fallo.
4. **Las pruebas de F1-02 no demuestran la regla clave.** El test "nunca devuelve vehículos VENDIDO ni ocultos" pasa solo porque el seed no tiene ninguno. Reforzar `src/server/catalog/queries.test.ts`:
   - Crear en el propio test (y limpiar en `afterAll`/`finally`) un vehículo `VENDIDO`, uno con `visibleCatalogo = false` y uno `RESERVADO`, con un color marcador único (ej. `__test__`), y verificar: los dos primeros no salen en `listVehicles` (ni con `disponibilidad=VENDIDO` en la URL, que debe ignorarse) ni en `getVehicleById` (→ `null`); el reservado sí sale.
   - Preferible usar una base aparte con `DATABASE_URL_TEST` (documentarlo en `.env.example` y en `ci.yml`); si no, que los datos de prueba se creen y borren dentro del test sin tocar los del seed.
   - Verificar que la placa completa nunca aparece en el JSON serializado de `getVehicleById` para un usado.

## Fuera de alcance

Crear páginas legales, rediseñar el footer, nuevas funcionalidades.

## Criterios de aceptación

- [x] `site-content.ts` no contiene razón social ni año fijo, y toda afirmación no confirmada lleva `TODO(owner)`.
- [x] Ningún enlace del footer devuelve 404 (probar con `curl` tras `pnpm build && pnpm start`).
- [x] Con la BD apagada, `getDealerConfig()` devuelve el respaldo, y al volver la BD y expirar/invalidar la caché devuelve el valor real; hay un test que cubre el fallo.
- [x] Los tests de F1-02 fallan si se quita `visibleCatalogo: true` o la exclusión de `VENDIDO` de `listVehicles` (comprobarlo quitándolas temporalmente y anotar el resultado en las notas).
- [x] `pnpm check`, `pnpm build` y CI en verde.

## Verificación

```bash
pnpm check && pnpm build
pnpm start & for p in / /catalogo /proximamente; do curl -s -o /dev/null -w "%{http_code} $p\n" localhost:3000$p; done
curl -s localhost:3000/ | grep -c "S.A. de C.V."   # debe ser 0
```

## Recordatorio de proceso

Rama `issue/F1-07-correcciones-revision` + PR; al terminar, estado `REVIEW`. **No fusionar el PR ni marcar `DONE`**: lo hace el orquestador tras revisar.

## Notas de entrega

### Qué se hizo

1. **Limpieza de contenido editorial en `src/lib/site-content.ts` y footer**:
   - Se removió `legalName` y cualquier mención a "S.A. de C.V.". La línea de copyright en el footer ahora es `© <año> JDS Vehículos. Todos los derechos reservados.`.
   - Se removió `platformBadge`, se reemplazó `shortDescription` por "Concesionario de vehículos nuevos y seminuevos" y se eliminó el año fijo de `heroTag` dejando `'Showroom Certificado JDS Vehículos'` con su etiqueta `TODO(owner)`.
   - Se vaciaron los enlaces rotos de `footerLinks` con comentario `TODO(owner)` para que el footer no contenga enlaces que resulten en 404.
2. **Caché en `src/server/config.ts`**:
   - Se desacopló la consulta a la base de datos en una función interna `fetchDealerConfigFromDb()` anotada con `'use cache'` y `cacheTag('dealer-config')`. Al lanzar error ante fallos de conexión, Next.js no persiste el fallo en la caché.
   - `getDealerConfig()` atrapa la excepción y retorna el respaldo de forma transitoria.
   - Se creó `src/server/config.test.ts` verificando el comportamiento exitoso y la recuperación transitoria ante fallos de base de datos.
3. **Robustecimiento de pruebas en `src/server/catalog/queries.test.ts`**:
   - En `beforeAll`, se crean fixtures con color marcador único `__test_marker_f107__`: un vehículo `VENDIDO`, uno oculto (`visibleCatalogo = false`) y uno `RESERVADO`. En `afterAll` se eliminan limpiamente.
   - Se verifica que ni el vendido ni el oculto aparezcan en `listVehicles` (incluso si se envía `disponibilidad: 'VENDIDO'` en los filtros).
   - Se comprueba que `getVehicleById` retorne `null` para el vendido y para el oculto.
   - Se verifica que para un usado la placa real no aparezca jamás en el JSON serializado y que solo viaje la versión enmascarada (`***777`).
   - Se verificó que quitar `visibleCatalogo: true` o la exclusión de `VENDIDO` de `listVehicles` rompe inmediatamente las pruebas correspondientes con fallos de aserción.
4. **Verificaciones ejecutadas**:
   - `curl -s localhost:3000/ | grep -c "S.A. de C.V."` arrojó `0`.
   - `pnpm check` (format, lint, typecheck, tests) y `pnpm build` pasan al 100%.
