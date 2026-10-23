# F5-03: Operación, respaldos y arranque del primer administrador

- **Estado:** TODO
- **Fase:** 5
- **Depende de:** F4-08 (DONE)
- **Prioridad:** Alta (lo necesita la Fase 6)

## Contexto

Hoy los usuarios demo salen del seed y las variables de entorno se validan por partes. En producción no debe haber usuarios demo, el primer administrador debe crearse de forma segura, hay datos (MySQL) y archivos (`UPLOADS_DIR`) que respaldar y hace falta saber si la aplicación está sana.

## Alcance

1. **Validación central de entorno** (`src/server/env.ts`, Zod): una sola definición de todas las variables (`DATABASE_URL`, `AUTH_SECRET`, `AUTH_TRUST_HOST`, `TRUST_PROXY`, `TRUST_PROXY_HOPS`, `UPLOADS_DIR`, `RESERVA_EXPIRACION_HORAS`, `NEXT_PUBLIC_*`, …) con reglas de producción (secreto de al menos 32 caracteres, `TRUST_PROXY=true` obligatorio, `UPLOADS_DIR` absoluta y escribible), que se ejecuta al arrancar (`instrumentation.ts`) y falla con un mensaje claro que **no imprime valores secretos**. `.env.example` generado/comprobado contra ese esquema por un test.
2. **Primer administrador sin seed demo:** comando `pnpm admin:crear` (script `tsx`): pide por entrada interactiva (o variables `ADMIN_EMAIL`/`ADMIN_NAME` y la contraseña por **entrada oculta** o variable solo si se indica un flag explícito) los datos, aplica la política de contraseña de F2-02 y bcrypt coste 12, rechaza si ya existe un `ADMIN`, y registra el evento sin la contraseña. Pruebas con BD (`*.db.test.ts`). `pnpm db:seed` no debe crear usuarios con contraseñas conocidas con `NODE_ENV=production` (ya aborta con `--demo`; comprobar el caso sin `--demo`).
3. **Respaldos:** `scripts/backup.sh` (bash, `set -euo pipefail`): `mysqldump --single-transaction --routines` comprimido + `tar` de `UPLOADS_DIR`, nombre con fecha, retención configurable (por defecto 14), permisos `0600`, sin contraseñas en la línea de comandos (usar un archivo de opciones o variable de entorno). `scripts/restore.sh` correspondiente con confirmación explícita. **Probar el ciclo completo** contra una BD temporal (respaldar → borrar → restaurar → comparar conteos) y pegar el resultado. Documentar en el README cómo programarlos con `cron` (se instala en la Fase 6).
4. **Salud:** ampliar `/api/health`: BD (consulta ligera), carpeta de subidas escribible y espacio libre aproximado; responde `200`/`503` con JSON mínimo, **sin versiones ni rutas ni mensajes de error internos**; cabecera `Cache-Control: no-store`. Una ruta distinta (`/api/health/live`) que solo confirma que el proceso responde, para el reinicio automático.
5. **Registro de eventos unificado:** un único módulo `logEvent({ channel, level, ... })` (línea JSON en stdout) que reemplace los `console.info`/`console.error` sueltos de seguridad, reservas, panel y errores; nivel por variable (`LOG_LEVEL`), nunca datos personales ni secretos (con prueba que lo verifique para los eventos conocidos). Documentar la rotación de logs en el servidor (Fase 6).
6. **Índices y consultas:** revisar con `EXPLAIN` las consultas del catálogo, del panel (reservas por estado/fecha, ventas por fecha, usuarios por búsqueda) y de expiración; añadir índices por migración **solo** donde el plan lo justifique, con el `EXPLAIN` antes/después en las notas.
7. **Migraciones:** documentar la política (`prisma migrate deploy` en producción, nunca `migrate dev`/`db push`), y un script de verificación que falle si el esquema de Prisma y las migraciones divergen (`prisma migrate diff`) — añadirlo al CI.

## Fuera de alcance

Instalar nada en el servidor (Fase 6), almacenamiento externo, monitoreo con servicios de terceros.

## Criterios de aceptación

- [ ] Arrancar con un entorno de producción incompleto o débil falla con un mensaje claro y sin imprimir secretos.
- [ ] `pnpm admin:crear` crea el primer ADMIN en una BD vacía y se niega si ya existe uno.
- [ ] El ciclo respaldar → destruir → restaurar recupera exactamente los datos y las fotos (evidencia en las notas).
- [ ] `/api/health` responde 200 con todo sano y 503 si la BD o la carpeta de subidas fallan (probado), sin filtrar detalles.
- [ ] `pnpm check`, `pnpm build` y `pnpm test:e2e` pasan; CI en verde.

## Recordatorio de proceso

Rama `issue/<ID>-<slug>` **creada desde `main` actualizado** (`git checkout main && git pull`), nunca encadenada sobre otra rama sin fusionar. PR al terminar y estado `REVIEW`. **No fusionar ni marcar `DONE`.** Las pruebas que usan la BD real se llaman `*.db.test.ts`; los e2e usan datos propios (nunca “la primera tarjeta” ni conteos globales) y no dejan residuos. Antes de empujar: `pnpm check`, `pnpm build` y `pnpm test:e2e` varias veces seguidas. Si el job E2E del CI falla en “Install Playwright system dependencies” es la red de `apt`: `gh run rerun --failed`. Texto visible en `site-content.ts`, sin afirmaciones comerciales inventadas. **Lee `AGENTS.md` y la documentación local de Next antes de escribir código.**
