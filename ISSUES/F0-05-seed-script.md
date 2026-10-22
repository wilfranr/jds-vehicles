# F0-05: Script de seed independiente

- **Estado:** REVIEW
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
- [x] `pnpm db:reset` (migra + seed) deja la BD usable desde cero.
- [x] Ejecutar `pnpm db:seed` dos veces seguidas no produce errores ni filas duplicadas (comprobar conteos).
- [x] Con `NODE_ENV=production` solo se cargan roles y configuración.
- [x] Los `password_hash` verifican correctamente con la librería elegida (probar con un script o test rápido y anotarlo).
- [x] `pnpm typecheck` y `pnpm lint` pasan.

## Verificación
```bash
pnpm db:reset
pnpm db:seed && pnpm db:seed
docker compose exec db mysql -ujds -pjds jds_vehiculos -e "SELECT COUNT(*) FROM roles; SELECT COUNT(*) FROM vehiculos;"
```

## Notas de entrega
- **Qué se hizo:**
  1. Creación de `prisma/seed.ts` completamente idempotente con `upsert` para todas las entidades.
  2. Registro en `package.json` de `"prisma": { "seed": "tsx prisma/seed.ts" }` y script `"db:seed": "prisma db seed"`.
  3. Carga incondicional de datos de referencia (Roles: `CLIENTE`, `ADMIN`, `ASESOR`; Configuración del concesionario: `whatsapp_numero`, `whatsapp_mensaje_plantilla`, `instagram_url`).
  4. Carga condicional de datos de demostración solo si `NODE_ENV !== 'production'` o con `--demo`:
     - Marcas: Toyota, Mazda, Chevrolet.
     - Modelos: Corolla, Hilux, CX-30, Mazda 3, Onix.
     - 3 vehículos de demostración con sus respectivas fotos principales y estados.
     - Usuarios Admin y Cliente con contraseñas cifradas con `bcryptjs` usando variables de entorno opcionales `SEED_ADMIN_PASSWORD` y `SEED_CLIENT_PASSWORD` (valores por defecto seguros de desarrollo y aviso en consola sin imprimir contraseñas).
  5. Verificación de hashing: script de prueba con `bcrypt.compare` confirmando que las contraseñas coinciden y hashes erróneos son rechazados.
  6. Prueba de idempotencia ejecutando `pnpm db:seed` dos veces consecutivas: conteos en base de datos permanecen inalterados (roles: 3, configs: 3, marcas: 3, modelos: 5, vehiculos: 3, usuarios: 2).
  7. Prueba con `NODE_ENV=production` verificando que omite los datos de demo y se activa únicamente si se añade la bandera `--demo`.
  8. Prueba integral de `pnpm db:reset` ejecutando migración y seed automatizado.
  9. Actualización de `.env.example` y `README.md` con las instrucciones correspondientes.
- **Desviaciones:** Ninguna.
- **Comandos de verificación ejecutados con éxito:**
  - `pnpm db:reset`
  - `pnpm db:seed && pnpm db:seed`
  - `NODE_ENV=production pnpm db:seed`
  - `NODE_ENV=production pnpm tsx prisma/seed.ts --demo`
  - `pnpm typecheck`
  - `pnpm lint`
