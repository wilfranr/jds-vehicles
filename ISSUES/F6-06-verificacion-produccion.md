# F6-06: Verificación en producción, runbook y cierre del proyecto

- **Estado:** TODO
- **Fase:** 6
- **Depende de:** F6-05
- **Prioridad:** Alta

## Alcance

1. `scripts/deploy/smoke.sh <url>`: comprobaciones de humo contra el sitio desplegado (solo lectura): salud, portada y catálogo con 200, ficha de un vehículo, `/login`, `/admin` redirige o da 404 según la sesión, cabeceras de seguridad y CSP presentes, `robots.txt`/`sitemap.xml`, `/media` con `nosniff`, sin cabeceras que revelen versiones, y cookies `Secure`/`HttpOnly`. Sale con código distinto de 0 ante cualquier fallo.
2. Recorrido manual guiado con el propietario (checklist en `docs/DESPLIEGUE.md`): crear una cuenta de cliente, reservar un vehículo de prueba, abrir el enlace de WhatsApp, entrar al panel, gestionar la reserva, registrar la venta y comprobar que el vehículo sale del catálogo; después **limpiar los datos de prueba** con el procedimiento documentado.
3. Auditoría desde fuera: Lighthouse móvil sobre la URL desplegada, `nmap` básico de la IP (solo los puertos esperados abiertos; con permiso del propietario sobre su propio servidor), y prueba de que MySQL no es accesible desde fuera.
4. **Simulacro**: rollback a la versión anterior y restauración de un respaldo en una BD temporal, ambos cronometrados.
5. `docs/DESPLIEGUE.md` final (runbook): arquitectura, accesos, variables, tareas programadas, cómo desplegar, revertir, restaurar, rotar secretos, renovar certificados, pasar a dominio; `ISSUES/PENDIENTES-PROPIETARIO.md` actualizado con lo que sigue abierto antes del lanzamiento público (textos legales, cifras de marca, dominio, correo de recuperación).

## Decisiones del propietario (2026-10-24)

Al ser una demostración quedan **fuera de alcance**: el simulacro de reinicio de la máquina, la restauración de un respaldo programado y las tareas de cron. Siguen vigentes (cuando se pida): `smoke.sh`, el recorrido manual, la auditoría externa y la actualización final de `docs/DESPLIEGUE.md`.

## Criterios de aceptación

- [ ] `smoke.sh` pasa contra el servidor.
- [ ] El recorrido del propietario se completa sin errores y los datos de prueba quedan limpios.
- [ ] Rollback y restauración probados con tiempos anotados.

## Recordatorio de proceso

Rama `issue/<ID>-<slug>` **desde `main` actualizado**, sin encadenar. PR al terminar y estado `REVIEW`; **no fusionar ni marcar `DONE`**. Pruebas con BD como `*.db.test.ts`; e2e con datos propios. `pnpm check`, `pnpm build` y `pnpm test:e2e` antes de empujar. **Nunca** poner secretos, IPs privadas ni llaves en el repositorio, en logs ni en las notas de entrega. **Lee `AGENTS.md` y la documentación local de Next.**
