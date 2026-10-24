# F6-03: Proxy inverso, HTTPS y red

- **Estado:** REVIEW
- **Fase:** 6
- **Depende de:** F5-01, F6-02
- **Prioridad:** Alta

## Contexto

Decisión del propietario: **por ahora se accede solo por la IP del servidor, sin dominio**. **El servidor ya tiene otra aplicación en el puerto 80 (nginx del host) y JDS convive con ella:** JDS publica **solo el 443** (libre y ya abierto en la lista de seguridad de Oracle), no usa el 80 y no modifica nginx. En producción las cookies de sesión son `Secure`: por HTTP plano **no se guardarían** y nadie podría iniciar sesión. Por eso el demo necesita HTTPS aunque sea con un certificado propio. Cuando exista un dominio, solo debe cambiar una línea.

## Alcance

1. Servicio `proxy` (Caddy, imagen fijada por versión) en `docker-compose.prod.yml`: única puerta de entrada (**solo el 443 publicado**, el puerto del host configurable con `HTTPS_PORT`; el 80 pertenece a la otra aplicación y no se publica; sin `ufw`), y Caddy con `auto_https disable_redirects` y sin escuchar en el 80, `app` y `db` solo en la red interna.
2. **Modo IP (ahora):** HTTPS con certificado interno de Caddy (`tls internal`) sobre la IP; documentar que el navegador mostrará una advertencia de certificado no confiable y cómo instalar la CA de Caddy en el equipo del propietario para evitarla. Sin redirección 80→443 (el 80 no es nuestro; se accede escribiendo `https://IP`). Evaluar y documentar si Let's Encrypt emite certificados para IP en ese momento (solo como alternativa; no depender de ello).
3. **Modo dominio (después):** la variable `SITE_ADDRESS` cambia de IP a dominio y Caddy obtiene el certificado público automáticamente; documentar los pasos (registro DNS A/AAAA; el reto de Let's Encrypt exige el 80 o `tls-alpn` en el 443: documentar la opción compatible con que nginx conserve el 80) y probarlos en seco con `caddy validate`.
4. Cabeceras y cuerpo: `client_max_body_size` equivalente de ~55 MB **solo** para `/admin/vehiculos/*/fotos`; el resto con límite bajo. `X-Forwarded-For` con la IP real del cliente **sobrescrita** (nunca confiar en la que envíe el cliente) y `TRUST_PROXY=true` con `TRUST_PROXY_HOPS=1`; `X-Forwarded-Proto`/`Host` correctos para Auth.js (`AUTH_TRUST_HOST=true`). Compresión (`zstd`/`gzip`) y caché de `/_next/static` y `/media` respetando las cabeceras de la aplicación.
5. **HSTS:** en modo IP con certificado interno **no** debe emitirse `Strict-Transport-Security` (un navegador que lo recuerde dejaría de poder entrar si cambia el certificado). Hacerlo configurable (`HSTS=on|off`) y apagado por defecto hasta que haya dominio con certificado público. **Ojo:** la propia aplicación (`src/server/security/headers.ts`, `next.config.ts`) emite HSTS cuando recibe `X-Forwarded-Proto: https`; con `HSTS=off` el proxy debe **eliminar** la cabecera de la respuesta (en Caddy, `header -Strict-Transport-Security`) o la aplicación debe poder desactivarla, y una prueba debe confirmar que con `HSTS=off` no llega al cliente (nota del orquestador tras F5-01).
6. **Firewall:** el servidor no tiene `ufw` y alberga otra aplicación; **no se instala ni activa** (afectaría a esa app y a las reglas de Docker). Documentar que la apertura del 443 se hace en la lista de seguridad de Oracle (ya hecha) y que cualquier firewall del host solo se añade con confirmación explícita del propietario.
7. **Pruebas:** con el compose levantado en local (certificado interno): `curl -k` a portada, `/login`, `/admin`, `/media/...`; comprobar que la IP del cliente llega a los limitadores (provocar el bloqueo de login desde dos IPs simuladas con `X-Forwarded-For` falso y comprobar que el proxy lo **ignora**); subida de una foto de ~4 MB atraviesa el proxy; 56 MB es rechazado.

## Criterios de aceptación

- [x] Iniciar sesión funciona por HTTPS con el certificado interno (la cookie se guarda).
- [x] Una cabecera `X-Forwarded-For` falsa enviada por el cliente no cambia la IP vista por la aplicación.
- [x] Sin HSTS en modo IP; con `HSTS=on` aparece.
- [x] `app` y `db` no son alcanzables desde fuera del compose.
- [x] CI en verde.

## Recordatorio de proceso

Rama `issue/<ID>-<slug>` **desde `main` actualizado**, sin encadenar. PR al terminar y estado `REVIEW`; **no fusionar ni marcar `DONE`**. Pruebas con BD como `*.db.test.ts`; e2e con datos propios. `pnpm check`, `pnpm build` y `pnpm test:e2e` antes de empujar. **Nunca** poner secretos, IPs privadas ni llaves en el repositorio, en logs ni en las notas de entrega. **Lee `AGENTS.md` y la documentación local de Next.**

## Notas de entrega

Guía en `docs/despliegue/PROXY.md`. **Dependencia:** `docker-compose.proxy.yml` se usa _junto a_ `docker-compose.prod.yml` de F6-02 (servicio `app` sano); este PR sale de `main` sin encadenar y solo añade el proxy, por lo que **debe fusionarse después de F6-02 (#74)**. Las pruebas se hicieron en local combinando ambas ramas (los archivos de F6-02 no forman parte de este PR). Sin secretos ni IPs reales en el repositorio.

**Qué se hizo**

1. Servicio `proxy` (`caddy:2.10.2`, fijada) en un _overlay_ `docker-compose.proxy.yml`: **publica solo el 443** (`HTTPS_PORT` / `HTTPS_BIND` configurables para pruebas), no el 80 ni el 2019; solo lectura, `cap_drop: ALL` + `NET_BIND_SERVICE`, 128 MB, logs rotados. `app` y `db` siguen sin puertos.
2. `deploy/proxy/Caddyfile` + fragmentos: `auto_https disable_redirects`, API de administración desactivada, solo HTTP/1.1 y HTTP/2, **sin escuchar el 80** (comprobado dentro del contenedor: solo `:::443`), `tls internal` (modo IP) o ACME solo por TLS-ALPN-01 (modo dominio, `SITE_ADDRESS`/`TLS_MODE`), compresión `zstd`/`gzip`, límite de cuerpo de 1 MB salvo `POST /admin/vehiculos/<id>/fotos` (55 MB; la app admite 51).
3. IP real: Caddy sustituye las `X-Forwarded-*` del cliente; la app usa `TRUST_PROXY=true`/`TRUST_PROXY_HOPS=1`.
4. **HSTS:** la app lo emite si ve `X-Forwarded-Proto: https`; el proxy lo **elimina** con `HSTS=off` (por defecto; `header_down -Strict-Transport-Security`) y lo fija con `HSTS=on`.
5. Pruebas: `src/server/deploy-proxy.test.ts` (13: solo el 443, sin el 80, solo lectura, HSTS off por defecto, sin `trusted_proxies`, límites, ALPN, sin IPs en la plantilla), `scripts/docker/proxy-check.sh` (comprobación externa reutilizable en el servidor) y un job de CI **«Proxy config (caddy validate)»** para IP/dominio.
6. Firewall: no se instala `ufw`; documentado (lista de seguridad de Oracle ya abierta, cualquier firewall del host solo con confirmación explícita).

**Hallazgo:** al entrar por IP el TLS fallaba con _«tlsv1 alert internal error»_: los navegadores no envían SNI para una IP y, tras el reenvío de puertos de Docker, la dirección local de la conexión es la del contenedor, así que Caddy no encontraba certificado. Se resolvió con `default_sni {$SITE_ADDRESS}` (cubierto por test).

**Evidencia (local, `https://127.0.0.1:8443`, stack de F6-02 + proxy)**

- Rutas: `/` 200 (HTTP/2), `/login` 200, `/admin` 307 (a login), `/media/no-existe.webp` 404, `/api/health` 200. HTTP plano en el puerto HTTPS → 400. `proxy-check.sh`: «PROXY OK» (15 comprobaciones).
- Cabeceras: CSP sin `unsafe-eval`, COOP/CORP, `X-Frame-Options`, sin `X-Powered-By`. Estáticos con `cache-control: public, max-age=31536000, immutable` (la de la app). `content-encoding: zstd` y `gzip` según `Accept-Encoding`.
- **HSTS:** conectando directo a la app con `X-Forwarded-Proto: https` responde `max-age=31536000; includeSubDomains`; por el proxy con `HSTS=off` → ninguna cabecera; con `HSTS=on` → `max-age=31536000; includeSubDomains`.
- **Inicio de sesión por HTTPS** con el certificado interno: las cookies `__Secure-authjs.*` se guardan (`Secure`, `HttpOnly`, `SameSite=Lax`) y `/admin` carga con sesión.
- **IP falsa:** 7 inicios de sesión fallidos, cada uno con `X-Forwarded-For` y `X-Real-IP` distintos y falsos: la app **bloqueó en el 6.º intento** y los eventos `login_failed`/`login_blocked` registraron siempre la IP real de la conexión (ninguna de las falsas).
- **Subidas:** foto de 3,8 MB por el proxy → «Se subió 1 fotografía.»; POST de 56 MB a `/admin/vehiculos/<id>/fotos` → **413**; POST de 2 MB a otra ruta → **413**.
- **Aislamiento:** `docker ps` solo muestra publicado `127.0.0.1:8443->443/tcp` (el resto son puertos «expuestos» sin publicar); `localhost:3000` no responde; `db` con `Ports={}`.
- CA interna: `root.crt` exportable con `docker cp` y, usada como `--cacert`, la verificación TLS pasa (`ssl_verify=0`).
- `caddy validate`: válida en modo IP+`internal`, dominio+`acme`+`HSTS=on` y dominio+`internal`.

**Pruebas:** `pnpm check` (84 archivos, 788 pruebas), `pnpm build`, `pnpm test:e2e` ×2: 157/157 (el PR no toca código de la aplicación).

**A revisar**

- **Let's Encrypt para IP:** en enero de 2026 se anunciaron certificados de IP (vida corta); no se verificó que Caddy 2.10.2 los emita y exigen el 443 accesible desde Internet. Queda como alternativa documentada, sin depender de ella.
- Mientras el navegador no confíe en la CA interna mostrará aviso de certificado (instrucciones para instalarla en `PROXY.md`).
- El respaldo/arranque ordenado del proxy en el despliegue (`up` con ambos _compose_) lo cubre F6-04.
