// @vitest-environment node
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  assertEnv,
  assertRuntimeEnv,
  checkUploadsWritable,
  ENV_VARIABLES,
  EnvError,
  getLogLevel,
  validateEnv,
} from './env';

const SECRET = 'a'.repeat(8) + 'Zq7!x9Lm2#Pw4$Rt6&Yu8*Io0@Kj1^Hg3%'; // 43 caracteres
const production = {
  NODE_ENV: 'production',
  DATABASE_URL: 'mysql://jds:clave-secreta-db@db.interna:3306/jds_vehiculos',
  AUTH_SECRET: SECRET,
  AUTH_TRUST_HOST: 'true',
  TRUST_PROXY: 'true',
  TRUST_PROXY_HOPS: '1',
  UPLOADS_DIR: '/var/jds/uploads',
  NEXT_PUBLIC_SITE_URL: 'https://jds.example.com',
  NEXT_PUBLIC_WHATSAPP_NUMBER: '573202353168',
};

const variables = (env: Record<string, string | undefined>) =>
  validateEnv(env).map((i) => i.variable);

describe('validateEnv — producción', () => {
  it('un entorno de producción completo es válido', () => {
    expect(validateEnv(production)).toEqual([]);
  });

  it('un entorno de producción vacío reporta todo lo obligatorio', () => {
    expect(variables({ NODE_ENV: 'production' }).sort()).toEqual(
      [
        'AUTH_SECRET',
        'AUTH_TRUST_HOST',
        'DATABASE_URL',
        'NEXT_PUBLIC_SITE_URL',
        'TRUST_PROXY',
        'UPLOADS_DIR',
      ].sort()
    );
  });

  it.each([
    ['AUTH_SECRET corto', { AUTH_SECRET: 'x'.repeat(31) }, 'AUTH_SECRET'],
    ['AUTH_SECRET trivial', { AUTH_SECRET: 'a'.repeat(40) }, 'AUTH_SECRET'],
    ['AUTH_SECRET de ejemplo', { AUTH_SECRET: 'changeme' }, 'AUTH_SECRET'],
    ['AUTH_TRUST_HOST no activo', { AUTH_TRUST_HOST: 'false' }, 'AUTH_TRUST_HOST'],
    ['TRUST_PROXY no activo', { TRUST_PROXY: '' }, 'TRUST_PROXY'],
    ['TRUST_PROXY_HOPS inválido', { TRUST_PROXY_HOPS: 'abc' }, 'TRUST_PROXY_HOPS'],
    ['UPLOADS_DIR relativa', { UPLOADS_DIR: './uploads' }, 'UPLOADS_DIR'],
    [
      'URL del sitio con http',
      { NEXT_PUBLIC_SITE_URL: 'http://jds.example.com' },
      'NEXT_PUBLIC_SITE_URL',
    ],
    ['URL del sitio inválida', { NEXT_PUBLIC_SITE_URL: 'no es url' }, 'NEXT_PUBLIC_SITE_URL'],
    ['DATABASE_URL no mysql', { DATABASE_URL: 'postgres://u:p@h/db' }, 'DATABASE_URL'],
    ['DATABASE_URL sin base', { DATABASE_URL: 'mysql://u:p@h:3306' }, 'DATABASE_URL'],
    ['expiración inválida', { RESERVA_EXPIRACION_HORAS: '-3' }, 'RESERVA_EXPIRACION_HORAS'],
    ['LOG_LEVEL inválido', { LOG_LEVEL: 'verbose' }, 'LOG_LEVEL'],
    ['WhatsApp inválido', { NEXT_PUBLIC_WHATSAPP_NUMBER: '123' }, 'NEXT_PUBLIC_WHATSAPP_NUMBER'],
    ['HEALTH_MIN_FREE_MB inválido', { HEALTH_MIN_FREE_MB: 'mucho' }, 'HEALTH_MIN_FREE_MB'],
  ])('rechaza: %s', (_name, override, variable) => {
    expect(variables({ ...production, ...override })).toContain(variable);
  });

  it('acepta http en localhost (servidor de pruebas e2e) y expiración 0', () => {
    expect(
      validateEnv({
        ...production,
        NEXT_PUBLIC_SITE_URL: 'http://localhost:3100',
        RESERVA_EXPIRACION_HORAS: '0',
      })
    ).toEqual([]);
  });

  it('acepta NEXTAUTH_SECRET como alternativa a AUTH_SECRET', () => {
    expect(validateEnv({ ...production, AUTH_SECRET: undefined, NEXTAUTH_SECRET: SECRET })).toEqual(
      []
    );
  });
});

describe('validateEnv — desarrollo', () => {
  it('solo exige DATABASE_URL y valida formatos', () => {
    expect(variables({ NODE_ENV: 'development' })).toEqual(['DATABASE_URL']);
    expect(
      validateEnv({ NODE_ENV: 'development', DATABASE_URL: 'mysql://u:p@localhost:3307/jds' })
    ).toEqual([]);
    expect(
      variables({
        NODE_ENV: 'development',
        DATABASE_URL: 'mysql://u:p@localhost:3307/jds',
        LOG_LEVEL: 'x',
      })
    ).toEqual(['LOG_LEVEL']);
  });
});

describe('assertEnv / EnvError: nunca imprime valores', () => {
  it('el mensaje nombra la variable y la regla pero no contiene ningún valor', () => {
    const hostile = {
      ...production,
      AUTH_SECRET: 'corto-SECRETO-no-imprimir',
      DATABASE_URL: 'postgres://usuario:CLAVE-DB-SECRETA@host/db',
      UPLOADS_DIR: './ruta/privada',
      NEXT_PUBLIC_SITE_URL: 'http://sitio-inseguro.example',
    };
    let message = '';
    try {
      assertEnv(hostile);
    } catch (error) {
      expect(error).toBeInstanceOf(EnvError);
      message = (error as Error).message;
    }
    expect(message).toContain('AUTH_SECRET');
    expect(message).toContain('DATABASE_URL');
    for (const secret of [
      'SECRETO-no-imprimir',
      'CLAVE-DB-SECRETA',
      'ruta/privada',
      'sitio-inseguro',
      'usuario',
    ]) {
      expect(message).not.toContain(secret);
    }
  });

  it('no valida durante `next build`', () => {
    expect(() =>
      assertEnv({ NODE_ENV: 'production', NEXT_PHASE: 'phase-production-build' })
    ).not.toThrow();
  });
});

describe('carpeta de subidas', () => {
  let base: string;
  beforeAll(async () => {
    base = await mkdtemp(path.join(os.tmpdir(), 'jds-env-'));
  });
  afterAll(async () => {
    await chmod(base, 0o700).catch(() => undefined);
    await rm(base, { recursive: true, force: true });
  });

  it('se crea si falta y es escribible', async () => {
    expect(await checkUploadsWritable(path.join(base, 'nueva', 'subidas'))).toBeNull();
  });

  // Un archivo como «carpeta padre» no se puede crear (ENOTDIR) con cualquier usuario, incluido root.
  async function impossibleDir() {
    const file = path.join(base, 'es-un-archivo');
    await writeFile(file, 'x');
    return path.join(file, 'subidas');
  }

  it('una ruta imposible de crear devuelve un problema sin revelar la ruta', async () => {
    const problem = await checkUploadsWritable(await impossibleDir());
    expect(problem).toBeTruthy();
    expect(problem).not.toContain('es-un-archivo');
  });

  it('assertRuntimeEnv en producción falla si la carpeta no es escribible y no cita la ruta', async () => {
    let message = '';
    try {
      await assertRuntimeEnv({ ...production, UPLOADS_DIR: await impossibleDir() });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('UPLOADS_DIR');
    expect(message).not.toContain('es-un-archivo');
  });

  it('assertRuntimeEnv en producción acepta una carpeta escribible', async () => {
    await expect(
      assertRuntimeEnv({ ...production, UPLOADS_DIR: path.join(base, 'ok') })
    ).resolves.toBeUndefined();
  });

  it('fuera de producción no exige nada de la carpeta', async () => {
    await expect(
      assertRuntimeEnv({ NODE_ENV: 'development', DATABASE_URL: 'mysql://u:p@h:3306/db' })
    ).resolves.toBeUndefined();
  });
});

describe('getLogLevel', () => {
  it('por defecto info; respeta un nivel válido', () => {
    expect(getLogLevel({})).toBe('info');
    expect(getLogLevel({ LOG_LEVEL: 'debug' })).toBe('debug');
    expect(getLogLevel({ LOG_LEVEL: 'ruido' })).toBe('info');
  });
});

describe('.env.example', () => {
  const text = readFileSync(path.resolve('.env.example'), 'utf8');
  const documented = new Set([...text.matchAll(/^#?\s*([A-Z][A-Z0-9_]+)=/gm)].map((m) => m[1]!));

  it('documenta TODAS las variables del esquema', () => {
    for (const name of ENV_VARIABLES) expect(documented.has(name), name).toBe(true);
  });

  it('no documenta variables que el esquema no conoce (salvo las de los scripts de operación)', () => {
    const operation = new Set([
      'ADMIN_EMAIL',
      'ADMIN_NAME',
      'ADMIN_LASTNAME',
      'ADMIN_DOCUMENT_TYPE',
      'ADMIN_DOCUMENT',
      'ADMIN_PHONE',
      'BACKUP_DIR',
      'BACKUP_RETENTION',
    ]);
    for (const name of documented) {
      expect(ENV_VARIABLES.includes(name as never) || operation.has(name), name).toBe(true);
    }
  });

  it('los valores de ejemplo no contienen secretos reales (AUTH_SECRET vacío)', () => {
    expect(text).toMatch(/^AUTH_SECRET=\s*$/m);
  });
});
