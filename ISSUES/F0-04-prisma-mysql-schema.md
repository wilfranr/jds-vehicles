# F0-04: MySQL local (Docker) + Prisma + migración base

- **Estado:** TODO
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
- [ ] `pnpm db:up && pnpm db:migrate` crea las 9 tablas desde cero.
- [ ] Inspeccionar el esquema generado con `SHOW CREATE TABLE` coincide con `database.sql`: tipos, uniques, FKs (con sus acciones) e índices.
- [ ] Insertar un vehículo `USADO` sin placa **falla** por el CHECK; uno `NUEVO` sin placa funciona (probar y anotar el resultado en las notas).
- [ ] `pnpm db:reset` recrea todo sin intervención.
- [ ] `/api/health` refleja el estado de la BD (probar con la BD apagada → 503).
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm build` pasan.

## Verificación
```bash
pnpm db:up
pnpm db:migrate
docker compose exec db mysql -ujds -pjds jds_vehiculos -e "SHOW TABLES; SHOW CREATE TABLE vehiculos\G"
curl -s localhost:3000/api/health
```
