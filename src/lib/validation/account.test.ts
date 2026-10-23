import { describe, it, expect } from 'vitest';
import { siteContent } from '@/lib/site-content';
import { createChangePasswordSchema, firstFieldErrors, PROFILE_FIELDS } from './account';
import { createProfileSchema, createRegisterSchema } from './register';

const profile = createProfileSchema(siteContent.registro.errors);
const changePassword = createChangePasswordSchema({
  currentRequired: siteContent.cuenta.security.errors.currentRequired,
  password: siteContent.registro.errors,
});

const validProfile = {
  nombre: ' Ana ',
  apellido: 'Pérez',
  telefono: '+57 310 555 1234',
  ciudad: '',
  direccion: undefined,
};

describe('esquema de edición de perfil', () => {
  it('normaliza igual que el registro (teléfono con prefijo 57, textos recortados)', () => {
    const result = profile.safeParse(validProfile);
    expect(result.success && result.data).toMatchObject({
      nombre: 'Ana',
      telefono: '573105551234',
      ciudad: undefined,
    });
  });

  it('comparte reglas con el registro: mismos resultados para los mismos campos', () => {
    const registro = createRegisterSchema(siteContent.registro.errors);
    for (const telefono of ['3105551234', '2105551234', 'abc', '+573105551234']) {
      const a = profile.safeParse({ ...validProfile, telefono });
      const b = registro.safeParse({ telefono });
      const registroTelefonoOk =
        b.success || !b.error.issues.some((issue) => issue.path[0] === 'telefono');
      expect(a.success).toBe(registroTelefonoOk);
    }
  });

  it.each([
    ['nombre', { nombre: 'A' }],
    ['apellido', { apellido: '' }],
    ['telefono', { telefono: '12345' }],
    ['ciudad', { ciudad: 'x'.repeat(101) }],
    ['direccion', { direccion: 'x'.repeat(256) }],
  ])('rechaza %s inválido', (field, overrides) => {
    const result = profile.safeParse({ ...validProfile, ...overrides });
    expect(result.success).toBe(false);
    if (!result.success) expect(firstFieldErrors(result.error)).toHaveProperty(field);
  });

  it('descarta campos que no son del perfil (id, correo, documento, rol)', () => {
    const result = profile.safeParse({
      ...validProfile,
      id: '999',
      email: 'otro@example.com',
      documento: '1',
      rolId: 3,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(Object.keys(result.data).sort()).toEqual([...PROFILE_FIELDS].sort());
  });
});

describe('esquema de cambio de contraseña', () => {
  const valid = {
    currentPassword: 'Actual-Clave1',
    newPassword: 'Nueva-Clave-22',
    confirmPassword: 'Nueva-Clave-22',
  };

  it('acepta una entrada válida', () => {
    expect(changePassword.safeParse(valid).success).toBe(true);
  });

  it.each([
    ['currentPassword', { currentPassword: '' }],
    ['newPassword', { newPassword: 'corta1', confirmPassword: 'corta1' }],
    ['newPassword', { newPassword: 'SoloLetrasLargas', confirmPassword: 'SoloLetrasLargas' }],
    ['newPassword', { newPassword: 'password123', confirmPassword: 'password123' }],
    ['confirmPassword', { confirmPassword: 'Distinta-Clave-3' }],
  ])('rechaza %s inválido', (field, overrides) => {
    const result = changePassword.safeParse({ ...valid, ...overrides });
    expect(result.success).toBe(false);
    if (!result.success) expect(firstFieldErrors(result.error)).toHaveProperty(field);
  });
});
