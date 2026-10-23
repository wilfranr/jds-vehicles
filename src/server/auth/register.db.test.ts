import { describe, it, expect, vi, afterAll } from 'vitest';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { siteContent } from '@/lib/site-content';
import { createRegisterSchema, type RegisterInput } from '@/lib/validation/register';
import { BCRYPT_COST } from './password';
import { DUMMY_PASSWORD_HASH } from './verify-credentials';
import { registerUser, type NewUserData, type RegisterDeps } from './register';

const schema = createRegisterSchema(siteContent.registro.errors);

function input(overrides: Record<string, unknown> = {}): RegisterInput {
  return schema.parse({
    nombre: 'Test',
    apellido: 'Registro',
    tipoDocumento: 'CC',
    documento: '99900011',
    email: 'registro-test@example.com',
    telefono: '3105551234',
    password: 'Clave-Segura1',
    confirmPassword: 'Clave-Segura1',
    consentimiento: 'on',
    ...overrides,
  });
}

function makeDeps(overrides: Partial<RegisterDeps> = {}): RegisterDeps {
  return {
    findRoleIdByName: vi.fn(async () => 5),
    hashPassword: vi.fn(async (plain: string) => `hash:${plain}`),
    createUser: vi.fn(async (data: NewUserData) => ({ id: 1, email: data.email })),
    now: () => new Date('2026-01-02T03:04:05Z'),
    ...overrides,
  };
}

describe('registerUser (dependencias simuladas)', () => {
  it('crea el usuario con el rol CLIENTE buscado por nombre y la fecha de consentimiento', async () => {
    const deps = makeDeps();
    const result = await registerUser(input(), deps);

    expect(result).toEqual({ ok: true, user: { id: 1, email: 'registro-test@example.com' } });
    expect(deps.findRoleIdByName).toHaveBeenCalledWith('CLIENTE');
    expect(deps.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        rolId: 5,
        telefono: '573105551234',
        passwordHash: 'hash:Clave-Segura1',
        consentimientoDatosAt: new Date('2026-01-02T03:04:05Z'),
        direccion: null,
        ciudad: null,
      })
    );
  });

  it('devuelve "duplicate" ante la violación de unicidad P2002 sin consulta previa', async () => {
    const error = new Prisma.PrismaClientKnownRequestError('dup', {
      code: 'P2002',
      clientVersion: 'test',
    });
    const deps = makeDeps({ createUser: vi.fn().mockRejectedValue(error) });
    expect(await registerUser(input(), deps)).toEqual({ ok: false, reason: 'duplicate' });
  });

  it('propaga errores inesperados', async () => {
    const deps = makeDeps({ createUser: vi.fn().mockRejectedValue(new Error('boom')) });
    await expect(registerUser(input(), deps)).rejects.toThrow('boom');
  });

  it('devuelve "config" si no existe el rol CLIENTE y no crea nada', async () => {
    const deps = makeDeps({ findRoleIdByName: vi.fn(async () => null) });
    expect(await registerUser(input(), deps)).toEqual({ ok: false, reason: 'config' });
    expect(deps.createUser).not.toHaveBeenCalled();
  });
});

describe('coste de bcrypt', () => {
  it('el hash ficticio usa el mismo coste que los registros nuevos', () => {
    expect(bcrypt.getRounds(DUMMY_PASSWORD_HASH)).toBe(BCRYPT_COST);
  });
});

describe('registerUser (integración con la BD)', () => {
  const EMAIL = 'f202-integracion@example.com';
  const DOC = 'F202INTEG01';

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: EMAIL } });
  });

  it('crea un CLIENTE con hash bcrypt verificable, teléfono con prefijo y consentimiento; rechaza duplicados', async () => {
    const deps: RegisterDeps = {
      findRoleIdByName: async (name) =>
        (await prisma.role.findUnique({ where: { nombre: name } }))?.id ?? null,
      hashPassword: (plain) => bcrypt.hash(plain, BCRYPT_COST),
      createUser: (data) => prisma.user.create({ data, select: { id: true, email: true } }),
    };
    const data = input({ email: EMAIL, documento: DOC });

    const created = await registerUser(data, deps);
    expect(created.ok).toBe(true);

    const row = await prisma.user.findUniqueOrThrow({
      where: { email: EMAIL },
      include: { rol: true },
    });
    expect(row.rol.nombre).toBe('CLIENTE');
    expect(row.telefono).toBe('573105551234');
    expect(row.consentimientoDatosAt).toBeInstanceOf(Date);
    expect(row.passwordHash).toMatch(/^\$2[aby]\$12\$/);
    expect(await bcrypt.compare('Clave-Segura1', row.passwordHash)).toBe(true);

    // Mismo correo o mismo documento: resultado genérico y sin filas nuevas.
    expect(await registerUser(data, deps)).toEqual({ ok: false, reason: 'duplicate' });
    const otherEmail = input({ email: 'f202-otro@example.com', documento: DOC });
    expect(await registerUser(otherEmail, deps)).toEqual({ ok: false, reason: 'duplicate' });
    expect(
      await prisma.user.count({ where: { OR: [{ email: EMAIL }, { documentoIdentidad: DOC }] } })
    ).toBe(1);
  });
});
