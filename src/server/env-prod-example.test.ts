// @vitest-environment node
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ENV_VARIABLES, validateEnv } from './env';

// `.env.prod.example` (F6-02) es la plantilla del archivo real del servidor: debe estar al día con la validación
// de F5-03 y no contener secretos.
const raw = readFileSync(path.resolve(__dirname, '../../.env.prod.example'), 'utf8');
const entries = raw
  .split('\n')
  .filter((l) => l.trim() && !l.trim().startsWith('#'))
  .map((l) => {
    const i = l.indexOf('=');
    return [l.slice(0, i).trim(), l.slice(i + 1).trim()] as [string, string];
  });
const example = Object.fromEntries(entries);

/** Variables de operación que no valida la aplicación pero sí Compose o los scripts de respaldo. */
const OPERATION = [
  'MYSQL_ROOT_PASSWORD',
  'MYSQL_DATABASE',
  'MYSQL_USER',
  'MYSQL_PASSWORD',
  'BACKUP_DIR',
  'BACKUP_RETENTION',
];
/** Solo para desarrollo/seed: no pertenecen a producción. */
const DEV_ONLY = ['DB_PORT', 'SEED_ADMIN_PASSWORD', 'SEED_CLIENT_PASSWORD'];

describe('.env.prod.example', () => {
  it('solo declara variables conocidas (validadas por la app u operativas)', () => {
    const known = new Set<string>([...ENV_VARIABLES, ...OPERATION]);
    expect(Object.keys(example).filter((k) => !known.has(k))).toEqual([]);
  });

  it('incluye todas las variables que la validación de producción exige', () => {
    const required = ENV_VARIABLES.filter(
      (v) =>
        !DEV_ONLY.includes(v) &&
        v !== 'HEALTH_MIN_FREE_MB' &&
        v !== 'LOG_LEVEL' &&
        v !== 'RESERVA_EXPIRACION_HORAS' &&
        v !== 'NEXT_PUBLIC_WHATSAPP_NUMBER' &&
        v !== 'TRUST_PROXY_HOPS'
    );
    expect(required.filter((v) => !(v in example))).toEqual([]);
  });

  it('no trae secretos: contraseñas y AUTH_SECRET vacíos o marcados para cambiar', () => {
    for (const name of ['MYSQL_ROOT_PASSWORD', 'MYSQL_PASSWORD', 'AUTH_SECRET']) {
      expect(example[name], name).toBe('');
    }
    expect(example.DATABASE_URL).toContain('CAMBIAR_POR');
    expect(example.NEXT_PUBLIC_SITE_URL).toContain('CAMBIAR_POR');
  });

  it('rellenado con valores sensatos pasa la validación de producción', () => {
    const filled = {
      ...example,
      NODE_ENV: 'production',
      AUTH_SECRET: 'x'.repeat(8) + 'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6',
      DATABASE_URL: 'mysql://jds:clave@db:3306/jds_vehiculos',
      NEXT_PUBLIC_SITE_URL: 'https://203.0.113.10',
    };
    expect(validateEnv(filled).filter((i) => i.variable !== 'UPLOADS_DIR')).toEqual([]);
  });

  it('es la plantilla de producción: confía en el proxy y usa la carpeta de subidas del contenedor', () => {
    expect(example.AUTH_TRUST_HOST).toBe('true');
    expect(example.TRUST_PROXY).toBe('true');
    expect(example.TRUST_PROXY_HOPS).toBe('1');
    expect(example.UPLOADS_DIR).toBe('/data/uploads');
  });
});
