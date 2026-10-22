# F0-05: Script de seed independiente

- **Estado:** TODO
- **Fase:** 0
- **Depende de:** F0-04
- **Prioridad:** Media

## Contexto
`docs/legacy/database.sql` mezclaba esquema y datos de ejemplo. Los `password_hash` de ejemplo eran inválidos (`$2y$10$e8K7...` truncados). Ahora los datos iniciales deben vivir en un seed idempotente, separado de las migraciones.

## Alcance
1. `prisma/seed.ts` registrado en `package.json` (`"prisma": { "seed": "tsx prisma/seed.ts" }`) y script `db:seed`.
2. **Datos de referencia** (se cargan siempre, también en producción), con `upsert` para ser idempotentes:
   - `roles`: CLIENTE, ADMIN, ASESOR.
   - `configuracion_concesionario`: `whatsapp_numero`, `whatsapp_mensaje_plantilla`, `instagram_url` con los mismos valores de `docs/legacy/database.sql`.
3. **Datos de demostración** (solo si `NODE_ENV !== 'production'` o con flag `--demo`):
   - marcas/modelos (Toyota, Mazda, Chevrolet y sus modelos), 3 vehículos con foto principal, usuario admin y usuario cliente de prueba.
   - Contraseñas **hasheadas de verdad** con `bcryptjs` (o `argon2`) a partir de variables `SEED_ADMIN_PASSWORD` / `SEED_CLIENT_PASSWORD` (añadir a `.env.example`); si faltan, usar un valor por defecto de desarrollo y avisar por consola.
   - Nunca imprimir contraseñas en logs.
4. El seed debe poder ejecutarse varias veces sin duplicar ni fallar.
5. Documentar en `README.md` cómo cargar datos de referencia y de demo.

## Fuera de alcance
Imágenes reales del inventario (Fase 6), lógica de registro de usuarios (Fase 2).

## Criterios de aceptación
- [ ] `pnpm db:reset` (migra + seed) deja la BD usable desde cero.
- [ ] Ejecutar `pnpm db:seed` dos veces seguidas no produce errores ni filas duplicadas (comprobar conteos).
- [ ] Con `NODE_ENV=production` solo se cargan roles y configuración.
- [ ] Los `password_hash` verifican correctamente con la librería elegida (probar con un script o test rápido y anotarlo).
- [ ] `pnpm typecheck` y `pnpm lint` pasan.

## Verificación
```bash
pnpm db:reset
pnpm db:seed && pnpm db:seed
docker compose exec db mysql -ujds -pjds jds_vehiculos -e "SELECT COUNT(*) FROM roles; SELECT COUNT(*) FROM vehiculos;"
```
