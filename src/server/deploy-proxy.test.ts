// @vitest-environment node
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// Invariantes de la configuración del proxy (F6-03) que no deben romperse por descuido: el servidor comparte
// máquina con otra aplicación (el 80 es suya) y las decisiones de HSTS/XFF son de seguridad.
const root = path.resolve(__dirname, '../..');
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');
/** Sin comentarios (`#`): los comentarios explican justo lo que las reglas prohíben. */
const code = (text: string) =>
  text
    .split('\n')
    .map((line) => line.replace(/(^|\s)#.*$/, ''))
    .join('\n');

const caddyfile = code(read('deploy/proxy/Caddyfile'));
const upstream = code(read('deploy/proxy/upstream.caddy'));
const compose = code(read('docker-compose.proxy.yml'));

describe('docker-compose.proxy.yml', () => {
  it('publica únicamente el 443 (nunca el 80 ni otros puertos)', () => {
    const block = /^\s*ports:\n((?:\s+-\s.*\n)+)/m.exec(compose)?.[1] ?? '';
    const ports = block.split('\n').filter((l) => l.trim());
    expect(ports).toHaveLength(1);
    expect(ports[0]).toMatch(/:443'$/);
    expect(compose).not.toMatch(/:80\b/);
    expect(compose).not.toMatch(/2019/);
  });

  it('el proxy es de solo lectura, sin capacidades extra salvo enlazar el 443', () => {
    expect(compose).toContain('read_only: true');
    expect(compose).toContain('cap_drop: [ALL]');
    expect(compose).toContain('cap_add: [NET_BIND_SERVICE]');
    expect(compose).toContain('no-new-privileges:true');
  });

  it('HSTS apagado y certificado interno por defecto', () => {
    expect(compose).toContain('HSTS: ${HSTS:-off}');
    expect(compose).toContain('TLS_MODE: ${TLS_MODE:-internal}');
  });

  it('imagen fijada por versión (no `latest`)', () => {
    expect(compose).toMatch(/image: caddy:\d+\.\d+\.\d+\b/);
  });
});

describe('Caddyfile', () => {
  it('no escucha ni redirige el puerto 80 y no expone la API de administración', () => {
    expect(caddyfile).toContain('auto_https disable_redirects');
    expect(caddyfile).toContain('admin off');
    expect(caddyfile).not.toMatch(/http_port|:80\b/);
  });

  it('solo HTTP/1.1 y HTTP/2 (TCP): no abre UDP/443', () => {
    expect(caddyfile).toMatch(/protocols h1 h2/);
  });

  it('límite bajo de cuerpo salvo la subida de fotos (~55 MB)', () => {
    expect(caddyfile).toMatch(/path_regexp \^\/admin\/vehiculos\/\[0-9\]\+\/fotos\$/);
    expect(caddyfile).toContain('max_size 55MB');
    expect(caddyfile).toContain('max_size 1MB');
  });

  it('comprime con zstd y gzip', () => {
    expect(caddyfile).toContain('encode zstd gzip');
  });

  it('el HSTS se decide por HSTS=on|off, con off por defecto, y se elimina la cabecera de la app', () => {
    expect(upstream).toContain('hsts-{$HSTS:off}.caddy');
    expect(read('deploy/proxy/hsts-off.caddy')).toContain('header_down -Strict-Transport-Security');
    expect(read('deploy/proxy/hsts-on.caddy')).toMatch(/max-age=31536000; includeSubDomains/);
  });

  it('no confía en X-Forwarded-* del cliente (sin trusted_proxies ni header_up de X-Forwarded-For)', () => {
    expect(caddyfile + upstream).not.toMatch(/trusted_proxies/);
    expect(caddyfile + upstream).not.toMatch(/header_up\s+X-Forwarded-For/i);
  });

  it('el modo dominio usa solo TLS-ALPN-01 (el 80 es de otra aplicación)', () => {
    expect(read('deploy/proxy/tls-acme.caddy')).toContain('disable_http_challenge');
    expect(read('deploy/proxy/tls-internal.caddy')).toContain('tls internal');
  });

  it('sirve el certificado de SITE_ADDRESS aunque el navegador no envíe SNI (acceso por IP)', () => {
    expect(caddyfile).toContain('default_sni {$SITE_ADDRESS}');
  });
});

describe('deploy/proxy/env.proxy.example', () => {
  const example = code(read('deploy/proxy/env.proxy.example'));
  it('no trae IPs ni dominios reales y deja HSTS apagado', () => {
    expect(example).toContain('SITE_ADDRESS=CAMBIAR_POR_IP_O_DOMINIO');
    expect(example).toContain('HSTS=off');
    expect(example).toContain('TLS_MODE=internal');
    expect(example.replace('0.0.0.0', '')).not.toMatch(/\b\d{1,3}(\.\d{1,3}){3}\b/);
  });
});
