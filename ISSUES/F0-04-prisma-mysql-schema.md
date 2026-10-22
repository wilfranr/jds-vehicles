# F0-04: MySQL local (Docker) + Prisma + migración base

- **Estado:** REVIEW
- **Fase:** 0
- **Depende de:** F0-02
- **Prioridad:** Alta

## Contexto
El modelo de datos está definido en `docs/legacy/database.sql` (y descrito en `docs/DOCUMENTACION.md`). Ese script usa `DROP TABLE IF EXISTS` y mezcla DDL con datos de ejemplo, así que no sirve para producción. Hay que sustituirlo por migraciones versionadas con Prisma sobre MySQL 8, **conservando el esquema fielmente**.

## Alcance
1. `docker-compose.yml` con servicio `db` MySQL 8.0:
   - charset `utf8mb4`, collation `utf8mb4_unicode_ci`;
   - base `jds_vehiculos`, usuario `jds` / contraseña `jds` (solo desarrollo);
   - volumen persistente y healthcheck;
   - puerto 3306 configurable.
2. Instalar `prisma` y `@prisma/client`. Crear `prisma/schema.prisma` con `provider = "mysql"` que modele las **9 tablas** de `database.sql`:
   `roles`, `usuarios`, `marcas`, `modelos`, `vehiculos`, `vehiculo_fotos`, `reservas`, `ventas`, `configuracion_concesionario`.
   - Respetar nombres de tabla/columna con `@@map` / `@map`; los modelos de Prisma en PascalCase singular (`Role`, `User`/`Usuario`: elegir y documentar la convención; recomendado: modelos en inglés PascalCase con `@@map` al nombre español).
   - Enums de MySQL → `enum` de Prisma (`tipo_documento`, `condicion`, `transmision`, `combustible`, `disponibilidad`, `estado` de reserva, `metodo_pago`).
   - `anio` como `Int @db.Year`; `precio` / `precio_final` como `Decimal @db.Decimal(12, 2)`; `UNSIGNED` con `@db.UnsignedInt`.
   - Todas las FKs con las mismas reglas `onDelete` / `onUpdate` del SQL, los `UNIQUE` (incluidos `ventas.vehiculo_id`, `ventas.reserva_id`, `modelos(marca_id, nombre)`) y los índices.
   - `created_at` / `updated_at` con `@default(now())` y `@updatedAt`.
3. Migración inicial (`prisma migrate dev --name init`). El `CHECK chk_placa_usado` (usado ⇒ placa no vacía) no lo soporta Prisma: añadirlo **editando el SQL de la migración** y documentarlo en un comentario del schema.
4. `src/lib/db.ts`: singleton de `PrismaClient` (patrón seguro para hot-reload de Next.js).
5. Ampliar `/api/health` para ejecutar `SELECT 1` y devolver `{ "status": "ok", "db": "up" }`; si falla, `503` con `"db": "down"`.
6. Scripts en `package.json`: `db:up` (docker compose up -d db), `db:down`, `db:migrate`, `db:generate`, `db:studio`, `db:reset`.
7. Documentar en `README.md` el arranque de la base de datos (reemplaza `TODO(F0-04)`).
8. En `docs/DOCUMENTACION.md`, sustituir la sección 4 ("Instrucciones de importación en DBeaver") por las instrucciones de migraciones con Prisma; conservar una nota breve de que `docs/legacy/database.sql` es referencia histórica.

## Fuera de alcance
Datos semilla (F0-05), lógica de reservas/ventas, Auth.js.

## Criterios de aceptación
- [x] `pnpm db:up && pnpm db:migrate` crea las 9 tablas desde cero.
- [x] Inspeccionar el esquema generado con `SHOW CREATE TABLE` coincide con `database.sql`: tipos, uniques, FKs (con sus acciones) e índices.
- [x] Insertar un vehículo `USADO` sin placa **falla** por el CHECK; uno `NUEVO` sin placa funciona (probar y anotar el resultado en las notas).
- [x] `pnpm db:reset` recrea todo sin intervención.
- [x] `/api/health` refleja el estado de la BD (probar con la BD apagada → 503).
- [x] `pnpm typecheck`, `pnpm lint`, `pnpm build` pasan.

## Verificación
```bash
pnpm db:up
pnpm db:migrate
docker compose exec db mysql -ujds -pjds jds_vehiculos -e "SHOW TABLES; SHOW CREATE TABLE vehiculos\G"
curl -s localhost:3000/api/health
```

## Notas de entrega
- **Qué se hizo:**
  1. Configuración de `docker-compose.yml` con servicio MySQL 8.0, charset `utf8mb4`, collation `utf8mb4_unicode_ci`, credenciales de desarrollo, volumen persistente, healthcheck y mapeo de puerto `${DB_PORT:-3307}:3306` (se usa 3307 por defecto para evitar colisión con servicios de MySQL/MariaDB activos en el host).
  2. Modelado de las 9 tablas en `prisma/schema.prisma` utilizando nombres de modelos en inglés PascalCase mapeados con `@@map` a los nombres en español de `database.sql`, conservando todos los tipos exactos (`@db.Year`, `@db.Decimal(12, 2)`, `@db.UnsignedInt`), enums, FKs con acciones referenciales íntegras (`RESTRICT`, `CASCADE`, `SET NULL`) e índices.
  3. Creación de migración inicial `20261022180100_init` agregando el constraint `CHECK chk_placa_usado (((condicion = 'USADO') and (placa is not null) and (placa <> '')) or (condicion = 'NUEVO'))`.
  4. Prueba del constraint `CHECK`:
     - Inserción con `condicion='USADO'` y `placa=NULL` falló con: `ERROR 3819 (HY000): Check constraint 'chk_placa_usado' is violated`.
     - Inserción con `condicion='USADO'` y `placa=''` falló con: `ERROR 3819 (HY000): Check constraint 'chk_placa_usado' is violated`.
     - Inserción con `condicion='NUEVO'` y `placa=NULL` se ejecutó exitosamente.
  5. Implementación del singleton `src/lib/db.ts` para PrismaClient seguro con hot-reload.
  6. Endpoint `src/app/api/health/route.ts` ampliado con consulta `SELECT 1`: retorna 200 `{ "status": "ok", "db": "up" }` cuando la BD está disponible y 503 `{ "status": "error", "db": "down" }` cuando está apagada (ambos escenarios probados).
  7. Configuración de scripts en `package.json`: `db:up`, `db:down`, `db:migrate`, `db:generate`, `db:studio`, `db:reset`.
  8. Actualización de `README.md` y de la sección 4 de `docs/DOCUMENTACION.md` detallando el uso de Docker y Prisma.
- **Desviaciones:** Ninguna en funcionalidad; el puerto exterior por defecto se fijó en 3307 para convivir pacíficamente con cualquier base de datos preinstalada en el host.
- **Comandos de verificación ejecutados con éxito:**
  - `pnpm db:up`
  - `pnpm db:migrate`
  - `pnpm db:reset`
  - `docker compose exec db mysql -ujds -pjds jds_vehiculos -e "SHOW TABLES; SHOW CREATE TABLE vehiculos\G"`
  - `curl -s http://localhost:3000/api/health` -> HTTP 200 `{"status":"ok","db":"up"}`
  - `curl -s http://localhost:3000/api/health` con DB detenida -> HTTP 503 `{"status":"error","db":"down"}`
  - `pnpm typecheck`, `pnpm lint`, `pnpm build` pasaron sin errores.
