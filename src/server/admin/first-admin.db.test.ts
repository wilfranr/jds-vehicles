// @vitest-environment node
import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import bcrypt from 'bcryptjs';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createTempDatabase, type TempDatabase } from '@/test-utils/temp-db';
import { createFirstAdmin, type FirstAdminInput } from './first-admin';

// Primer administrador (F5-03). Se prueba en una BD TEMPORAL (migraciones aplicadas, sin usuarios): la de desarrollo
// ya tiene un ADMIN y no se toca. Sin permiso para crear bases de datos las pruebas se omiten (en CI es obligatorio).
const run = promisify(execFile);
const PASSWORD = 'Clave-Inicial-2026';
let temp: TempDatabase | null = null;
let empty: TempDatabase | null = null;

const valid = (overrides: Partial<FirstAdminInput> = {}): FirstAdminInput => ({
  nombre: 'Laura',
  apellido: 'Gómez',
  tipoDocumento: 'CC',
  documento: '52.123.456',
  email: 'Laura.Gomez@Example.com',
  telefono: '+57 310 555 1234',
  password: PASSWORD,
  ...overrides,
});

beforeAll(async () => {
  temp = await createTempDatabase();
  if (!temp && process.env.CI)
    throw new Error('Las pruebas del primer administrador necesitan una BD temporal en CI.');
  await temp?.seedRoles();
  empty = await createTempDatabase(); // sin roles
});
afterAll(async () => {
  await temp?.drop();
  await empty?.drop();
});
afterEach(() => vi.restoreAllMocks());

const resetUsers = () => temp!.prisma.$executeRawUnsafe('DELETE FROM usuarios');

describe('createFirstAdmin (BD temporal)', () => {
  it('crea el primer ADMIN con bcrypt de coste 12, datos normalizados y consentimiento', async (ctx) => {
    if (!temp) return ctx.skip();
    await resetUsers();
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});

    const result = await createFirstAdmin(temp.prisma, valid());

    expect(result.status).toBe('ok');
    const user = await temp.prisma.user.findFirstOrThrow({ include: { rol: true } });
    expect(user).toMatchObject({
      email: 'laura.gomez@example.com',
      documentoIdentidad: '52123456',
      telefono: '573105551234',
      activo: true,
    });
    expect(user.rol.nombre).toBe('ADMIN');
    expect(user.consentimientoDatosAt).not.toBeNull();
    expect(user.passwordHash).toMatch(/^\$2[aby]\$12\$/);
    expect(await bcrypt.compare(PASSWORD, user.passwordHash)).toBe(true);
    // El evento solo lleva el id: ni contraseña, ni hash, ni correo
    const logged = info.mock.calls.map((c) => String(c[0])).join('\n');
    expect(logged).toContain('first_admin_created');
    expect(logged).not.toContain(PASSWORD);
    expect(logged).not.toContain(user.passwordHash);
    expect(logged).not.toContain('laura');
  });

  it('se niega si ya existe un ADMIN (aunque esté desactivado)', async (ctx) => {
    if (!temp) return ctx.skip();
    await resetUsers();
    vi.spyOn(console, 'info').mockImplementation(() => {});
    expect((await createFirstAdmin(temp.prisma, valid())).status).toBe('ok');

    expect(
      await createFirstAdmin(
        temp.prisma,
        valid({ email: 'otro@example.com', documento: '99999999' })
      )
    ).toEqual({
      status: 'exists',
    });
    await temp.prisma.user.updateMany({ data: { activo: false } });
    expect(
      (
        await createFirstAdmin(
          temp.prisma,
          valid({ email: 'otro@example.com', documento: '99999999' })
        )
      ).status
    ).toBe('exists');
    expect(await temp.prisma.user.count()).toBe(1);
  });

  it('dos ejecuciones simultáneas no crean dos administradores', async (ctx) => {
    if (!temp) return ctx.skip();
    await resetUsers();
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const results = await Promise.all([
      createFirstAdmin(temp.prisma, valid({ email: 'uno@example.com', documento: '1111111111' })),
      createFirstAdmin(temp.prisma, valid({ email: 'dos@example.com', documento: '2222222222' })),
      createFirstAdmin(temp.prisma, valid({ email: 'tres@example.com', documento: '3333333333' })),
    ]);
    expect(results.filter((r) => r.status === 'ok')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'exists')).toHaveLength(2);
    expect(await temp.prisma.user.count()).toBe(1);
  });

  it('rechaza datos inválidos con errores por campo y no crea nada', async (ctx) => {
    if (!temp) return ctx.skip();
    await resetUsers();
    for (const [overrides, field] of [
      [{ password: 'corta1' }, 'password'],
      [{ password: 'SoloLetrasLargasSinNumero' }, 'password'],
      [{ password: 'password123' }, 'password'],
      [{ email: 'no-es-correo' }, 'email'],
      [{ telefono: '12345' }, 'telefono'],
      [{ tipoDocumento: 'DNI' }, 'tipoDocumento'],
      [{ documento: '12' }, 'documento'],
      [{ nombre: 'A' }, 'nombre'],
    ] as [Partial<FirstAdminInput>, string][]) {
      const result = await createFirstAdmin(temp.prisma, valid(overrides));
      expect(result.status, field).toBe('invalid');
      if (result.status === 'invalid') expect(result.fieldErrors, field).toHaveProperty(field);
    }
    expect(await temp.prisma.user.count()).toBe(0);
  });

  it('el correo o el documento de otro usuario → duplicate', async (ctx) => {
    if (!temp) return ctx.skip();
    await resetUsers();
    await temp.prisma.user.create({
      data: {
        rolId: 1,
        nombre: 'Cliente',
        apellido: 'Existente',
        documentoIdentidad: '52123456',
        email: 'cliente@example.com',
        passwordHash: 'x',
        telefono: '573000000000',
      },
    });
    expect(await createFirstAdmin(temp.prisma, valid())).toEqual({ status: 'duplicate' });
    expect(
      await createFirstAdmin(
        temp.prisma,
        valid({ documento: '777777777', email: 'cliente@example.com' })
      )
    ).toEqual({
      status: 'duplicate',
    });
  });

  it('sin roles de referencia → roles_missing', async (ctx) => {
    if (!empty) return ctx.skip();
    expect(await createFirstAdmin(empty.prisma, valid())).toEqual({ status: 'roles_missing' });
  });
});

describe('pnpm admin:crear (script, con --password-from-env)', () => {
  const tsx = path.resolve('node_modules/.bin/tsx');
  const env = (url: string) => ({
    ...process.env,
    DATABASE_URL: url,
    ADMIN_NAME: 'Mario',
    ADMIN_LASTNAME: 'Ríos',
    ADMIN_DOCUMENT_TYPE: 'cc',
    ADMIN_DOCUMENT: '80123456',
    ADMIN_EMAIL: 'mario.rios@example.com',
    ADMIN_PHONE: '3205550000',
    ADMIN_PASSWORD: 'Script-Clave-2026',
  });

  async function runScript(url: string, args: string[] = ['--password-from-env']) {
    try {
      const { stdout, stderr } = await run(tsx, ['scripts/create-admin.ts', ...args], {
        env: env(url),
        timeout: 60_000,
      });
      return { code: 0, out: stdout + stderr };
    } catch (error) {
      const e = error as { code?: number; stdout?: string; stderr?: string };
      return { code: e.code ?? 1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
    }
  }

  it('crea el ADMIN en una BD vacía, se niega la segunda vez y nunca imprime la contraseña', async (ctx) => {
    if (!temp) return ctx.skip();
    await resetUsers();
    const first = await runScript(temp.url);
    expect(first.code, first.out).toBe(0);
    expect(first.out).toContain('Administrador creado');
    expect(first.out).not.toContain('Script-Clave-2026');

    const second = await runScript(temp.url);
    expect(second.code).toBe(2);
    expect(second.out).toContain('Ya existe un administrador');
    expect(second.out).not.toContain('Script-Clave-2026');
    expect(await temp.prisma.user.count()).toBe(1);
  }, 120_000);

  it('sin terminal y sin --password-from-env no pide ni acepta la contraseña por otra vía', async (ctx) => {
    if (!temp) return ctx.skip();
    await resetUsers();
    const result = await runScript(temp.url, []);
    expect(result.code).toBe(1);
    expect(result.out).toContain('--password-from-env');
    expect(await temp.prisma.user.count()).toBe(0);
  }, 120_000);

  it('una contraseña débil se rechaza con un mensaje claro', async (ctx) => {
    if (!temp) return ctx.skip();
    await resetUsers();
    const weak = await run(tsx, ['scripts/create-admin.ts', '--password-from-env'], {
      env: { ...env(temp.url), ADMIN_PASSWORD: 'corta1' },
      timeout: 60_000,
    }).then(
      () => ({ code: 0, out: '' }),
      (error: { code?: number; stdout?: string; stderr?: string }) => ({
        code: error.code ?? 1,
        out: `${error.stdout ?? ''}${error.stderr ?? ''}`,
      })
    );
    expect(weak.code).toBe(1);
    expect(weak.out).toContain('password');
    expect(weak.out).not.toContain('corta1');
    expect(await temp.prisma.user.count()).toBe(0);
  }, 120_000);
});

describe('pnpm db:seed en producción (BD temporal)', () => {
  const tsx = path.resolve('node_modules/.bin/tsx');
  let seedDb: TempDatabase | null = null;

  beforeAll(async () => {
    seedDb = await createTempDatabase();
  });
  afterAll(async () => {
    await seedDb?.drop();
  });

  const seed = (url: string, args: string[], extra: Record<string, string> = {}) =>
    run(tsx, ['prisma/seed.ts', ...args], {
      env: {
        ...process.env,
        DATABASE_URL: url,
        NODE_ENV: 'production',
        SEED_ADMIN_PASSWORD: '',
        SEED_CLIENT_PASSWORD: '',
        ...extra,
      },
      timeout: 120_000,
    }).then(
      ({ stdout, stderr }) => ({ code: 0, out: stdout + stderr }),
      (error: { code?: number; stdout?: string; stderr?: string }) => ({
        code: error.code ?? 1,
        out: `${error.stdout ?? ''}${error.stderr ?? ''}`,
      })
    );

  it('sin --demo solo siembra datos de referencia: ningún usuario ni contraseña conocida', async (ctx) => {
    if (!seedDb) return ctx.skip();
    const result = await seed(seedDb.url, []);
    expect(result.code, result.out).toBe(0);
    expect(await seedDb.prisma.user.count()).toBe(0);
    expect(await seedDb.prisma.role.count()).toBe(3);
    expect(await seedDb.prisma.vehiculo.count()).toBe(0);
  }, 180_000);

  it('con --demo exige las contraseñas por variable (no usa las conocidas) y no crea usuarios si faltan', async (ctx) => {
    if (!seedDb) return ctx.skip();
    const result = await seed(seedDb.url, ['--demo']);
    expect(result.code).toBe(1);
    expect(result.out).toContain('SEED_ADMIN_PASSWORD');
    expect(await seedDb.prisma.user.count()).toBe(0);
  }, 180_000);
});
