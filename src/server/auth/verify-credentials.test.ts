import { describe, it, expect, vi } from 'vitest';
import bcrypt from 'bcryptjs';
import {
  verifyCredentials,
  DUMMY_PASSWORD_HASH,
  type CredentialsUserRecord,
  type VerifyCredentialsDeps,
} from './verify-credentials';

const PASSWORD = 'Clave-Segura1*';
const passwordHash = bcrypt.hashSync(PASSWORD, 4);

const baseUser: CredentialsUserRecord = {
  id: 7,
  nombre: 'Ana',
  apellido: 'Pérez',
  email: 'ana@example.com',
  passwordHash,
  activo: true,
  rol: { nombre: 'CLIENTE' },
};

function makeDeps(user: CredentialsUserRecord | null) {
  const findUserByEmail = vi.fn(async () => user);
  const comparePassword = vi.fn((plain: string, hash: string) => bcrypt.compare(plain, hash));
  return {
    deps: { findUserByEmail, comparePassword } satisfies VerifyCredentialsDeps,
    findUserByEmail,
    comparePassword,
  };
}

describe('verifyCredentials', () => {
  it('devuelve el usuario público con credenciales correctas', async () => {
    const { deps } = makeDeps(baseUser);
    const result = await verifyCredentials('ana@example.com', PASSWORD, deps);
    expect(result).toEqual({ id: 7, rol: 'CLIENTE', name: 'Ana Pérez', email: 'ana@example.com' });
  });

  it('no incluye passwordHash ni otros campos sensibles', async () => {
    const { deps } = makeDeps({ ...baseUser, rol: { nombre: 'ADMIN' } });
    const result = await verifyCredentials('ana@example.com', PASSWORD, deps);
    expect(Object.keys(result!).sort()).toEqual(['email', 'id', 'name', 'rol']);
    expect(JSON.stringify(result)).not.toContain(passwordHash);
  });

  it('devuelve null con contraseña errónea', async () => {
    const { deps } = makeDeps(baseUser);
    expect(await verifyCredentials('ana@example.com', 'otra-clave', deps)).toBeNull();
  });

  it('devuelve null si el correo no existe y compara igualmente contra el hash ficticio', async () => {
    const { deps, comparePassword } = makeDeps(null);
    expect(await verifyCredentials('nadie@example.com', PASSWORD, deps)).toBeNull();
    expect(comparePassword).toHaveBeenCalledWith(PASSWORD, DUMMY_PASSWORD_HASH);
  });

  it('devuelve null con usuario inactivo aunque la contraseña sea correcta', async () => {
    const { deps } = makeDeps({ ...baseUser, activo: false });
    expect(await verifyCredentials('ana@example.com', PASSWORD, deps)).toBeNull();
  });

  it('devuelve null si el rol no es uno de los permitidos', async () => {
    const { deps } = makeDeps({ ...baseUser, rol: { nombre: 'OTRO' } });
    expect(await verifyCredentials('ana@example.com', PASSWORD, deps)).toBeNull();
  });

  it.each([
    ['vacío', '', ''],
    ['correo vacío', '', PASSWORD],
    ['contraseña vacía', 'ana@example.com', ''],
    ['correo con formato inválido', 'no-es-correo', PASSWORD],
    ['no son cadenas', undefined, null],
    ['correo gigante', `${'a'.repeat(300)}@example.com`, PASSWORD],
    ['contraseña gigante', 'ana@example.com', 'x'.repeat(10_000)],
  ])(
    'devuelve null sin lanzar ni consultar la BD con entrada inválida: %s',
    async (_n, email, pw) => {
      const { deps, findUserByEmail } = makeDeps(baseUser);
      await expect(verifyCredentials(email, pw, deps)).resolves.toBeNull();
      expect(findUserByEmail).not.toHaveBeenCalled();
    }
  );

  it('normaliza el correo (espacios y mayúsculas)', async () => {
    const { deps, findUserByEmail } = makeDeps(baseUser);
    const result = await verifyCredentials('  ANA@Example.COM  ', PASSWORD, deps);
    expect(findUserByEmail).toHaveBeenCalledWith('ana@example.com');
    expect(result?.id).toBe(7);
  });
});
