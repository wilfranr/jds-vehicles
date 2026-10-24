# F6-01: Reconocimiento del servidor Oracle (solo lectura)

- **Estado:** DONE
- **Fase:** 6
- **Responsable:** orquestador, por SSH, con autorización paso a paso del propietario (el agente desarrollador **no** accede al servidor)
- **Depende de:** — (puede hacerse ya)
- **Prioridad:** Alta (condiciona F6-02 a F6-04)

## Contexto

Datos conocidos (propietario): servidor propio en Oracle Cloud, Ubuntu/Debian con Docker instalado, acceso solo por IP (sin dominio todavía). Se desconoce la arquitectura (x86_64 o ARM/Ampere), versión de Docker/Compose, puertos libres, firewall y recursos.

## Alcance

1. Script `scripts/deploy/recon.sh` **de solo lectura** (sin `sudo` salvo lectura estrictamente necesaria, sin instalar ni modificar nada): sistema y versión, arquitectura, CPU/RAM/disco, usuario y grupos (`docker`), versión de Docker y del plugin Compose, contenedores y redes existentes, puertos en escucha (`ss -ltn`), estado de `ufw`/`iptables` (si se puede leer), zona horaria y hora (NTP), `unattended-upgrades`. **Nunca** imprime variables de entorno, llaves ni el contenido de archivos de configuración de otros servicios.
2. El orquestador lo ejecuta por SSH tras la confirmación del propietario y registra el resultado **sin datos sensibles** en `docs/DESPLIEGUE.md` (sección "Servidor"): arquitectura, versiones, puertos ocupados, recursos.
3. Decisiones derivadas, anotadas en el mismo documento: plataforma de las imágenes (`linux/amd64` o `linux/arm64`), si hay otros servicios en el servidor (y por tanto qué puertos usar), memoria disponible para la aplicación y MySQL, y qué debe abrir el propietario en la consola de Oracle (listas de seguridad / reglas de entrada para 80 y 443).
4. Lista de lo que el propietario debe hacer en la consola de Oracle (no se puede automatizar desde aquí).

## Resultado (2026-10-23, reconocimiento de solo lectura por SSH)

- Ubuntu 24.04 LTS, **arquitectura ARM (aarch64)**, 4 CPU, ~23 GB de RAM, ~32 GB de disco libres. Docker 29.1 y Compose 2.40. El usuario de despliegue está en los grupos `docker` y `sudo` (sudo sin contraseña).
- **El servidor ya aloja otra aplicación** (otro proyecto del propietario: contenedores propios y MySQL en `127.0.0.1:3306`) servida por **nginx del host en el puerto 80** (raíz). Puertos ocupados: 22, 80, 111, 1025, 3306 (solo local), 8000, 8025, 8080 (solo local). **El 443 está libre.** No hay `ufw`; `iptables` acepta la entrada.
- La lista de seguridad de Oracle solo permitía 22 y 80; el propietario añadió **443/TCP** (lista "443" asociada a la subred pública).
- **Decisiones derivadas:** (1) imágenes `linux/arm64`, construidas en el propio servidor; (2) JDS convive con la otra app: **solo publica el 443**, nunca toca nginx ni los puertos 80, 3306, 8000, 8080; (3) no se instala ni se activa `ufw` (afectaría a la otra aplicación y a Docker); la protección de red es la lista de seguridad de Oracle; (4) la BD de JDS vive en una red interna de Docker, sin puerto publicado; nombres de contenedores, red y volúmenes con prefijo `jds_` para no chocar con los existentes.
- Nada de esto incluye IPs, llaves ni configuraciones de la otra app.

## Criterios de aceptación

- [ ] El script no modifica nada (probado en local con `strace -f -e trace=file`/revisión del código: solo lecturas y comandos de consulta).
- [ ] `docs/DESPLIEGUE.md` tiene la sección "Servidor" sin datos sensibles.

## Recordatorio de proceso

Rama `issue/<ID>-<slug>` **desde `main` actualizado**, sin encadenar. PR al terminar y estado `REVIEW`; **no fusionar ni marcar `DONE`**. Pruebas con BD como `*.db.test.ts`; e2e con datos propios. `pnpm check`, `pnpm build` y `pnpm test:e2e` antes de empujar. **Nunca** poner secretos, IPs privadas ni llaves en el repositorio, en logs ni en las notas de entrega. **Lee `AGENTS.md` y la documentación local de Next.**
