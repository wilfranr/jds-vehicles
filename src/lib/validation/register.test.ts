import { describe, it, expect } from 'vitest';
import { siteContent } from '@/lib/site-content';
import {
  createRegisterSchema,
  fieldErrors,
  normalizeColombianMobile,
  normalizeDocument,
} from './register';

const schema = createRegisterSchema(siteContent.registro.errors);

const valid = {
  nombre: '  Ana María ',
  apellido: 'Pérez',
  tipoDocumento: 'CC',
  documento: '1.234.567-890',
  email: '  Ana.Perez@Example.COM ',
  telefono: '+57 310 555 1234',
  password: 'Clave-Segura1',
  confirmPassword: 'Clave-Segura1',
  ciudad: '',
  direccion: undefined,
  consentimiento: 'on',
};

function errorsFor(overrides: Record<string, unknown>) {
  const result = schema.safeParse({ ...valid, ...overrides });
  return result.success ? {} : fieldErrors(result.error);
}

describe('esquema de registro', () => {
  it('acepta y normaliza una entrada válida', () => {
    const result = schema.safeParse(valid);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toMatchObject({
      nombre: 'Ana María',
      email: 'ana.perez@example.com',
      documento: '1234567890',
      telefono: '573105551234',
      ciudad: undefined,
      direccion: undefined,
    });
  });

  it.each([
    ['nombre', { nombre: 'A' }],
    ['nombre', { nombre: 'x'.repeat(101) }],
    ['apellido', { apellido: '   ' }],
    ['tipoDocumento', { tipoDocumento: 'DNI' }],
    ['documento', { documento: '1234' }],
    ['documento', { documento: 'ab#cd12' }],
    ['documento', { documento: '1'.repeat(31) }],
    ['email', { email: 'no-es-correo' }],
    ['email', { email: `${'a'.repeat(150)}@example.com` }],
    ['telefono', { telefono: '2105551234' }],
    ['telefono', { telefono: '31055512' }],
    ['telefono', { telefono: 'abc' }],
    ['password', { password: 'Corta1', confirmPassword: 'Corta1' }],
    ['password', { password: 'SoloLetrasLargas', confirmPassword: 'SoloLetrasLargas' }],
    ['password', { password: '12345678901', confirmPassword: '12345678901' }],
    ['password', { password: 'Password123', confirmPassword: 'Password123' }],
    ['password', { password: `Aa1${'x'.repeat(80)}`, confirmPassword: `Aa1${'x'.repeat(80)}` }],
    ['confirmPassword', { confirmPassword: 'Otra-Clave-1' }],
    ['ciudad', { ciudad: 'x'.repeat(101) }],
    ['direccion', { direccion: 'x'.repeat(256) }],
    ['consentimiento', { consentimiento: undefined }],
    ['consentimiento', { consentimiento: 'off' }],
  ])('rechaza %s inválido', (field, overrides) => {
    expect(errorsFor(overrides)).toHaveProperty(field);
  });

  it('acepta el celular con 57, +57 o espacios y lo guarda con prefijo', () => {
    expect(normalizeColombianMobile('3105551234')).toBe('573105551234');
    expect(normalizeColombianMobile('573105551234')).toBe('573105551234');
    expect(normalizeColombianMobile('+57 (310) 555-1234')).toBe('573105551234');
    expect(normalizeColombianMobile('+1 310 555 1234')).toBeNull();
  });

  it('normaliza el documento a mayúsculas sin separadores', () => {
    expect(normalizeDocument(' ab-12.345 ')).toBe('AB12345');
  });

  it('no lanza con entradas hostiles', () => {
    const hostile = [
      'x'.repeat(10_000),
      '"\'; DROP TABLE usuarios; --',
      '<script>alert(1)</script>',
      '😀😀😀😀😀',
      'a\u0000b',
    ];
    for (const value of hostile) {
      for (const field of Object.keys(valid)) {
        expect(() => schema.safeParse({ ...valid, [field]: value })).not.toThrow();
      }
    }
    expect(errorsFor({ nombre: 'a\u0000b' })).toHaveProperty('nombre');
    expect(errorsFor({ nombre: 'x'.repeat(10_000) })).toHaveProperty('nombre');
  });

  it('trata campos ausentes o de otro tipo como inválidos sin lanzar', () => {
    expect(schema.safeParse({}).success).toBe(false);
    expect(schema.safeParse({ ...valid, nombre: 42, email: null }).success).toBe(false);
  });
});
