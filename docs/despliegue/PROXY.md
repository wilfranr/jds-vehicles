# Proxy inverso, HTTPS y red (F6-03)

El proxy es **Caddy** (`caddy:2.10.2`, fijada por versión) y la **única puerta de entrada**: publica **solo el 443**. El puerto 80
del servidor pertenece a otra aplicación (nginx del host): JDS no lo escucha, no lo publica ni lo redirige, y no toca nginx.
`app` y `db` no publican ningún puerto (solo la red interna `jds_internal`). No se instala ni activa `ufw`.

Archivos: `docker-compose.proxy.yml` (se usa junto a `docker-compose.prod.yml`), `deploy/proxy/Caddyfile` y sus fragmentos
(`tls-*.caddy`, `hsts-*.caddy`, `upstream.caddy`) y `deploy/proxy/env.proxy.example` (variables que se añaden al `.env.prod` del servidor).

```bash
export JDS_ENV_FILE=/ruta/segura/.env.prod
docker compose --env-file "$JDS_ENV_FILE" -f docker-compose.prod.yml -f docker-compose.proxy.yml up -d
```

## Variables

| Variable       | Valores                       | Qué hace                                                                |
| -------------- | ----------------------------- | ----------------------------------------------------------------------- |
| `SITE_ADDRESS` | IP o dominio                  | Dirección con la que se accede (y para la que se emite el certificado). |
| `TLS_MODE`     | `internal` (defecto) / `acme` | `internal`: CA interna de Caddy (IP). `acme`: Let's Encrypt (dominio).  |
| `HSTS`         | `off` (defecto) / `on`        | Interruptor de `Strict-Transport-Security`.                             |
| `HTTPS_PORT`   | defecto `443`                 | Puerto del host (pruebas locales: `8443`).                              |
| `HTTPS_BIND`   | defecto `0.0.0.0`             | Interfaz de escucha (pruebas locales: `127.0.0.1`).                     |

Además, en el `.env.prod` de la aplicación: `AUTH_TRUST_HOST=true`, `TRUST_PROXY=true`, `TRUST_PROXY_HOPS=1` y
`NEXT_PUBLIC_SITE_URL=https://<SITE_ADDRESS>[:puerto]` (se incrusta al construir la imagen: reconstruirla si cambia).

## Modo IP (ahora)

`TLS_MODE=internal`, `SITE_ADDRESS=<IP del servidor>`, `HSTS=off`. Se accede escribiendo `https://<IP>` (no hay redirección desde el
80, que no es nuestro). El navegador mostrará **«certificado no confiable»** porque lo firma la CA interna de Caddy. Para evitarlo,
instala esa CA en el equipo del propietario (el certificado raíz **no es secreto**; la clave privada nunca sale del volumen):

```bash
# En el servidor: copia la raíz pública a tu equipo
docker cp jds_proxy:/data/caddy/pki/authorities/local/root.crt ./jds-root.crt
```

- Windows: doble clic → «Instalar certificado» → equipo local → «Entidades de certificación raíz de confianza».
- macOS: Acceso a Llaveros → importar → «Confiar siempre». Linux/Chrome: Configuración → Privacidad → Seguridad → Administrar certificados → Autoridades → Importar.

Mientras no se instale, el inicio de sesión funciona igual (las cookies `Secure` se guardan con HTTPS aunque el certificado no sea de confianza).
La CA y los certificados viven en el volumen `jds_caddy_data`: conservarlo evita que cambien en cada reinicio.

**Sin dominio no hay certificado público.** Let's Encrypt anunció la disponibilidad general de certificados para direcciones IP
(perfil de vida corta, ~6 días) en enero de 2026, pero **no se ha verificado** que la versión de Caddy fijada los emita para IP
y renovarlos exige que el 443 sea alcanzable desde Internet; solo es una alternativa a evaluar, **no se depende de ello**.

## Modo dominio (después)

1. Registro DNS **A/AAAA** del dominio hacia la IP del servidor.
2. En `.env.prod`: `SITE_ADDRESS=www.ejemplo.com`, `TLS_MODE=acme`, `NEXT_PUBLIC_SITE_URL=https://www.ejemplo.com`, y `HSTS=on` cuando el certificado sea público y estable. Reconstruir la imagen de `app` (la URL se incrusta al compilar).
3. El reto de Let's Encrypt se resuelve por **TLS-ALPN-01 en el 443** (`tls-acme.caddy` desactiva el reto HTTP): **no necesita el 80**, así que nginx conserva su puerto. El 443 debe estar abierto en la lista de seguridad de Oracle (ya lo está).
4. Dry-run sin DNS: `docker run --rm -e SITE_ADDRESS=www.ejemplo.com -e TLS_MODE=acme -e HSTS=on -v "$PWD/deploy/proxy:/etc/caddy:ro" caddy:2.10.2 caddy validate --config /etc/caddy/Caddyfile` (el CI lo ejecuta para ambos modos).

## Cabeceras, IP real y límites

- **IP del cliente.** Caddy no confía en `X-Forwarded-*` enviados por el cliente: los sustituye por los suyos (IP de la conexión, protocolo y host). La app usa `TRUST_PROXY=true` y `TRUST_PROXY_HOPS=1` (un único proxy delante), por lo que los limitadores usan la IP real. No se configura `trusted_proxies`.
- **Auth.js:** `X-Forwarded-Proto/Host` correctos y `AUTH_TRUST_HOST=true`; el `Host` original (con puerto) llega a la app.
- **Cuerpo:** 1 MB para todo salvo `POST /admin/vehiculos/<id>/fotos`, que admite 55 MB (la app acepta hasta 51: 10 fotos de 5 MB más el formulario). Por encima, el proxy responde `413`.
- **Compresión:** `zstd` y `gzip`. **Caché:** el proxy no cachea; las cabeceras de la app se respetan tal cual (`/_next/static` sale `immutable`).
- **HSTS:** la app emite `Strict-Transport-Security` cuando recibe `X-Forwarded-Proto: https` (`src/server/security/headers.ts`). Con `HSTS=off` (por defecto) el proxy **elimina** esa cabecera de la respuesta (`header_down -Strict-Transport-Security`); con `HSTS=on` la fija (1 año, `includeSubDomains`). En modo IP debe quedar en `off`: un navegador que recordara HSTS no podría volver a entrar si cambia el certificado.
- **SNI:** al entrar por IP el navegador no envía SNI y, tras el reenvío de puertos de Docker, la dirección local es la del contenedor; por eso el Caddyfile usa `default_sni {$SITE_ADDRESS}` (sin él, el TLS falla con «internal error»).
- Solo HTTP/1.1 y HTTP/2 (TCP); API de administración de Caddy desactivada.

## Firewall

El servidor no tiene `ufw` y alberga otra aplicación: **no se instala ni se activa** (afectaría a esa aplicación y a las reglas de Docker).
La apertura del 443 se hace en la **lista de seguridad de Oracle** (ya hecha). Cualquier firewall del host solo se añade con la
confirmación explícita del propietario.

## Comprobación

```bash
scripts/docker/proxy-check.sh https://<IP>[:puerto] off     # o "on" si HSTS=on
```

Comprueba rutas (portada, `/login`, `/admin`, `/media/...`, `/api/health`), CSP sin `unsafe-eval`, ausencia de `X-Powered-By`,
estado de HSTS, compresión, `413` para 56 MB en la subida de fotos y para 2 MB en otras rutas, y que el HTTP plano se rechaza.
La prueba de la IP real (cabecera `X-Forwarded-For` falsa): 7 inicios de sesión fallidos, cada uno con una IP falsa distinta; si el proxy
las respetara nunca habría bloqueo, pero la app bloqueó en el 6.º intento y registró siempre la IP real de la conexión.
