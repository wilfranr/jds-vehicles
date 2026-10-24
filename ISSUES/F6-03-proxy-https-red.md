# F6-03: Proxy inverso, HTTPS y red

- **Estado:** TODO
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

- [ ] Iniciar sesión funciona por HTTPS con el certificado interno (la cookie se guarda).
- [ ] Una cabecera `X-Forwarded-For` falsa enviada por el cliente no cambia la IP vista por la aplicación.
- [ ] Sin HSTS en modo IP; con `HSTS=on` aparece.
- [ ] `app` y `db` no son alcanzables desde fuera del compose.
- [ ] CI en verde.

## Recordatorio de proceso

Rama `issue/<ID>-<slug>` **desde `main` actualizado**, sin encadenar. PR al terminar y estado `REVIEW`; **no fusionar ni marcar `DONE`**. Pruebas con BD como `*.db.test.ts`; e2e con datos propios. `pnpm check`, `pnpm build` y `pnpm test:e2e` antes de empujar. **Nunca** poner secretos, IPs privadas ni llaves en el repositorio, en logs ni en las notas de entrega. **Lee `AGENTS.md` y la documentación local de Next.**
