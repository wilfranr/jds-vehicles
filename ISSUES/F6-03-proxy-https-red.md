# F6-03: Proxy inverso, HTTPS y red

- **Estado:** TODO
- **Fase:** 6
- **Depende de:** F5-01, F6-02
- **Prioridad:** Alta

## Contexto

Decisión del propietario: **por ahora se accede solo por la IP del servidor, sin dominio**. En producción las cookies de sesión son `Secure`: por HTTP plano **no se guardarían** y nadie podría iniciar sesión. Por eso el demo necesita HTTPS aunque sea con un certificado propio. Cuando exista un dominio, solo debe cambiar una línea.

## Alcance

1. Servicio `proxy` (Caddy, imagen fijada por versión) en `docker-compose.prod.yml`: única puerta de entrada (80 y 443 publicados), `app` y `db` solo en la red interna.
2. **Modo IP (ahora):** HTTPS con certificado interno de Caddy (`tls internal`) sobre la IP; documentar que el navegador mostrará una advertencia de certificado no confiable y cómo instalar la CA de Caddy en el equipo del propietario para evitarla. Redirección de 80 a 443. Evaluar y documentar si Let's Encrypt emite certificados para IP en ese momento (solo como alternativa; no depender de ello).
3. **Modo dominio (después):** la variable `SITE_ADDRESS` cambia de IP a dominio y Caddy obtiene el certificado público automáticamente; documentar los pasos (registro DNS A/AAAA, apertura del puerto 80) y probarlos en seco con `caddy validate`.
4. Cabeceras y cuerpo: `client_max_body_size` equivalente de ~55 MB **solo** para `/admin/vehiculos/*/fotos`; el resto con límite bajo. `X-Forwarded-For` con la IP real del cliente **sobrescrita** (nunca confiar en la que envíe el cliente) y `TRUST_PROXY=true` con `TRUST_PROXY_HOPS=1`; `X-Forwarded-Proto`/`Host` correctos para Auth.js (`AUTH_TRUST_HOST=true`). Compresión (`zstd`/`gzip`) y caché de `/_next/static` y `/media` respetando las cabeceras de la aplicación.
5. **HSTS:** en modo IP con certificado interno **no** debe emitirse `Strict-Transport-Security` (un navegador que lo recuerde dejaría de poder entrar si cambia el certificado). Hacerlo configurable (`HSTS=on|off`) y apagado por defecto hasta que haya dominio con certificado público. **Ojo:** la propia aplicación (`src/server/security/headers.ts`, `next.config.ts`) emite HSTS cuando recibe `X-Forwarded-Proto: https`; con `HSTS=off` el proxy debe **eliminar** la cabecera de la respuesta (en Caddy, `header -Strict-Transport-Security`) o la aplicación debe poder desactivarla, y una prueba debe confirmar que con `HSTS=off` no llega al cliente (nota del orquestador tras F5-01).
6. **Firewall** del servidor (`ufw`) con la política documentada: permitir SSH (puerto actual), 80 y 443; denegar el resto. **No se aplica sin la confirmación explícita del propietario** (riesgo de quedarse sin acceso SSH): el script primero imprime lo que haría y deja una regla de seguridad para SSH.
7. **Pruebas:** con el compose levantado en local (certificado interno): `curl -k` a portada, `/login`, `/admin`, `/media/...`; comprobar que la IP del cliente llega a los limitadores (provocar el bloqueo de login desde dos IPs simuladas con `X-Forwarded-For` falso y comprobar que el proxy lo **ignora**); subida de una foto de ~4 MB atraviesa el proxy; 56 MB es rechazado.

## Criterios de aceptación

- [ ] Iniciar sesión funciona por HTTPS con el certificado interno (la cookie se guarda).
- [ ] Una cabecera `X-Forwarded-For` falsa enviada por el cliente no cambia la IP vista por la aplicación.
- [ ] Sin HSTS en modo IP; con `HSTS=on` aparece.
- [ ] `app` y `db` no son alcanzables desde fuera del compose.
- [ ] CI en verde.

## Recordatorio de proceso

Rama `issue/<ID>-<slug>` **desde `main` actualizado**, sin encadenar. PR al terminar y estado `REVIEW`; **no fusionar ni marcar `DONE`**. Pruebas con BD como `*.db.test.ts`; e2e con datos propios. `pnpm check`, `pnpm build` y `pnpm test:e2e` antes de empujar. **Nunca** poner secretos, IPs privadas ni llaves en el repositorio, en logs ni en las notas de entrega. **Lee `AGENTS.md` y la documentación local de Next.**
