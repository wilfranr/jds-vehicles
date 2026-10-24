# F6-05: Puesta en marcha en el servidor (ejecución)

- **Estado:** DONE
- **Fase:** 6
- **Responsable:** orquestador, por SSH, con autorización del propietario en cada paso que modifica el servidor
- **Depende de:** F6-01, F6-04
- **Prioridad:** Alta

## Alcance

1. Preparar el servidor sin tocar lo que ya exista: usuario/carpeta de la aplicación, clonar el repositorio por HTTPS de solo lectura (o con una llave de despliegue de solo lectura creada para esto), crear `.env.prod` en el servidor (secretos generados allí con `openssl`, nunca por el chat ni por el repositorio; el propietario guarda una copia cifrada).
2. Primer despliegue con `deploy.sh`, migraciones, **primer administrador** con `pnpm admin:crear` (la contraseña la escribe el propietario por entrada oculta), **sin datos demo**. Datos base: marcas y modelos reales desde el panel o un script de carga que el propietario valide.
3. Tareas programadas en el servidor (`cron` o temporizador de systemd): respaldo diario (retención 14), expiración de reservas cada 15 minutos (`pnpm reservas:expirar` en el contenedor), limpieza de logs; reinicio automático tras reinicio de la máquina (`restart: unless-stopped` y Docker habilitado en el arranque). Actualizaciones de seguridad automáticas del sistema (`unattended-upgrades`) confirmadas con el propietario.
4. Firewall según F6-03, **solo con confirmación explícita**.
5. Registrar en `docs/DESPLIEGUE.md` cada cambio hecho en el servidor (fecha, qué, por qué) sin secretos.

## Resultado (2026-10-24)

- Servidor: carpeta `~/jds` (permisos 700) con el repositorio clonado por una llave de despliegue de **solo lectura** y `~/jds/.env.prod` (permisos 600, secretos generados en el servidor). Etiqueta `v0.1.0` desplegada con `deploy.sh` (primera construcción arm64 sin incidentes); contenedores `jds_app`, `jds_db` y `jds_proxy` con `restart: unless-stopped` y Docker habilitado en el arranque. Solo se publica el 443; la otra aplicación del servidor no se modificó y sigue respondiendo igual.
- Roles sembrados con `prisma db seed` (sin `--demo`), primer administrador creado con `pnpm admin:crear` y datos de demostración cargados una sola vez (20 vehículos, 60 fotos con licencias abiertas —ver `docs/CREDITOS-FOTOS-DEMO.md`— y usuarios de prueba). Cambiar las contraseñas de prueba o borrarlas antes del lanzamiento.
- `proxy-check.sh` contra el sitio desplegado: todo correcto (la comprobación «HTTP plano» da falso fallo porque la IP sirve otra aplicación en el 80).
- **Decisiones del propietario (demo):** no se programa respaldo con cron (queda solo el respaldo automático de `deploy.sh` antes de cada migración); no se reinicia la máquina para demostrar el arranque automático; no se programa la expiración de reservas (`pnpm reservas:expirar`); sin `ufw`. Acceso solo por IP con certificado autofirmado.

## Criterios de aceptación

- [ ] El sitio responde por HTTPS desde la IP del servidor y el propietario inicia sesión con el administrador creado.
- [ ] Reiniciar la máquina deja el sitio funcionando sin intervención.
- [ ] Hay al menos un respaldo generado por el cron y se verificó su restauración en una BD temporal.

## Recordatorio de proceso

Rama `issue/<ID>-<slug>` **desde `main` actualizado**, sin encadenar. PR al terminar y estado `REVIEW`; **no fusionar ni marcar `DONE`**. Pruebas con BD como `*.db.test.ts`; e2e con datos propios. `pnpm check`, `pnpm build` y `pnpm test:e2e` antes de empujar. **Nunca** poner secretos, IPs privadas ni llaves en el repositorio, en logs ni en las notas de entrega. **Lee `AGENTS.md` y la documentación local de Next.**
