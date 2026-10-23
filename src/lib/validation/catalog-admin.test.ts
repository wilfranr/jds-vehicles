import { describe, expect, it } from 'vitest';
import { createIdSchema, createNameSchema } from './catalog-admin';

const name = createNameSchema({ name: 'nombre inválido', brand: 'marca inválida' });

describe('createNameSchema', () => {
  it('recorta y colapsa espacios', () => {
    expect(name.parse('  Mazda   CX 30 ')).toBe('Mazda CX 30');
  });
  it('rechaza vacío, solo espacios, demasiado largo y caracteres de control', () => {
    for (const bad of [
      '',
      '   ',
      'a'.repeat(101),
      'a'.repeat(200),
      'Maz\u0000da',
      'Maz\u007fda',
      7 as unknown as string,
    ]) {
      expect(name.safeParse(bad).success, String(bad)).toBe(false);
    }
  });
  it('admite exactamente 100 caracteres', () => {
    expect(name.parse('a'.repeat(100))).toHaveLength(100);
  });
});

describe('createIdSchema', () => {
  const id = createIdSchema('id inválido');
  it('convierte a número un id decimal positivo', () => {
    expect(id.parse(' 42 ')).toBe(42);
  });
  it('rechaza ceros a la izquierda, signos, decimales y vacíos', () => {
    for (const bad of ['0', '007', '-1', '1.5', '', 'abc', '12345678901']) {
      expect(id.safeParse(bad).success, bad).toBe(false);
    }
  });
});
