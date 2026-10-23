import { describe, it, expect } from 'vitest';
import { siteContent } from '@/lib/site-content';
import { createVehicleSchema, normalizePlate, parsePrice, type VehicleMessages } from './vehicle';

const e = siteContent.adminVehicles.errors;
const messages: VehicleMessages = {
  modelo: e.modelo,
  anio: e.anio,
  color: e.color,
  condicion: e.condicion,
  placa: e.placa,
  placaRequired: e.placaRequired,
  placaNotForNew: e.placaNotForNew,
  precio: e.precio,
  kilometraje: e.kilometraje,
  kilometrajeNew: e.kilometrajeNew,
  transmision: e.transmision,
  combustible: e.combustible,
  cilindraje: e.cilindraje,
  descripcion: e.descripcion,
  disponibilidad: e.disponibilidad,
};
const schema = createVehicleSchema(messages, () => new Date('2026-10-23T00:00:00Z'));

const used = {
  modeloId: '3',
  anio: '2022',
  color: '  Rojo Diamante ',
  condicion: 'USADO',
  placa: 'abc 123',
  precio: '92000000',
  kilometraje: '24500',
  transmision: 'AUTOMATICA',
  combustible: 'GASOLINA',
  cilindraje: '2000',
  descripcion: '  Único dueño.  ',
  disponibilidad: 'DISPONIBLE',
};
const brandNew = {
  ...used,
  condicion: 'NUEVO',
  placa: '',
  kilometraje: '0',
  cilindraje: '',
  descripcion: '',
};

function errorsFor(overrides: Record<string, unknown>) {
  const result = schema.safeParse({ ...used, ...overrides });
  if (result.success) return {};
  return Object.fromEntries(result.error.issues.map((i) => [String(i.path[0]), i.message]));
}

describe('esquema de vehículo', () => {
  it('acepta y normaliza un USADO válido (placa en mayúsculas sin espacios)', () => {
    const result = schema.safeParse(used);
    expect(result.success && result.data).toMatchObject({
      modeloId: 3,
      anio: 2022,
      color: 'Rojo Diamante',
      condicion: 'USADO',
      placa: 'ABC123',
      precio: '92000000.00',
      kilometraje: 24500,
      cilindraje: 2000,
      descripcion: 'Único dueño.',
    });
  });

  it('acepta un NUEVO sin placa, 0 km y sin opcionales', () => {
    const result = schema.safeParse(brandNew);
    expect(result.success && result.data).toMatchObject({
      condicion: 'NUEVO',
      placa: undefined,
      kilometraje: 0,
      cilindraje: undefined,
      descripcion: undefined,
    });
  });

  it('USADO sin placa se rechaza con error en la placa', () => {
    expect(errorsFor({ placa: '' }).placa).toBe(e.placaRequired);
    expect(errorsFor({ placa: undefined }).placa).toBe(e.placaRequired);
    expect(errorsFor({ placa: '   ' }).placa).toBe(e.placaRequired);
  });

  it('NUEVO no lleva placa y debe tener 0 km', () => {
    expect(errorsFor({ ...brandNew, placa: 'ABC123' }).placa).toBe(e.placaNotForNew);
    expect(errorsFor({ ...brandNew, kilometraje: '10' }).kilometraje).toBe(e.kilometrajeNew);
  });

  it.each(['AB', 'ABCDEFGHIJK', 'AB#123', 'ñandú1'])('placa inválida %j', (placa) => {
    expect(errorsFor({ placa }).placa).toBe(e.placa);
  });

  it.each([
    ['modeloId', '0'],
    ['modeloId', 'abc'],
    ['modeloId', '1.5'],
    ['anio', '1949'],
    ['anio', '2028'],
    ['anio', '20x2'],
    ['color', 'A'],
    ['color', 'x'.repeat(51)],
    ['condicion', 'DEMO'],
    ['precio', '0'],
    ['precio', '-5'],
    ['precio', '1e6'],
    ['precio', '1.234.567'],
    ['precio', '10000000000'],
    ['precio', '1.999'],
    ['kilometraje', '-1'],
    ['kilometraje', '1.5'],
    ['kilometraje', '12345678'],
    ['transmision', 'CVT'],
    ['combustible', 'NUCLEAR'],
    ['cilindraje', '49'],
    ['cilindraje', '10001'],
    ['cilindraje', 'abc'],
    ['descripcion', 'x'.repeat(2001)],
    ['descripcion', 'texto\u0000nulo'],
    ['disponibilidad', 'RESERVADO'],
    ['disponibilidad', 'VENDIDO'],
  ])('rechaza %s = %j', (field, value) => {
    expect(errorsFor({ [field]: value })).toHaveProperty(field);
  });

  it('el año máximo es el siguiente al actual', () => {
    expect(errorsFor({ anio: '2027' })).not.toHaveProperty('anio');
    expect(errorsFor({ anio: '2028' })).toHaveProperty('anio');
  });

  it('descripción de texto plano admite saltos de línea', () => {
    expect(errorsFor({ descripcion: 'línea 1\nlínea 2' })).not.toHaveProperty('descripcion');
  });

  it('un cuerpo con campos extra no los incluye en la salida', () => {
    const result = schema.safeParse({ ...used, id: '9', visibleCatalogo: 'false', rolId: '2' });
    expect(result.success).toBe(true);
    if (result.success)
      expect(Object.keys(result.data)).not.toEqual(expect.arrayContaining(['id']));
    if (result.success) expect(result.data).not.toHaveProperty('visibleCatalogo');
  });
});

describe('normalizePlate y parsePrice', () => {
  it('normaliza placas', () => {
    expect(normalizePlate(' ab-c 123 ')).toBe('ABC123');
  });

  it('el precio es decimal exacto (sin coma flotante) y positivo', () => {
    expect(parsePrice('115000000')).toBe('115000000.00');
    expect(parsePrice('0.10')).toBe('0.10');
    expect(parsePrice('1234.5')).toBe('1234.50');
    expect(parsePrice('007')).toBe('7.00');
    expect(parsePrice('0')).toBeNull();
    expect(parsePrice('0.00')).toBeNull();
    expect(parsePrice('9999999999.99')).toBe('9999999999.99');
    expect(parsePrice('')).toBeNull();
  });
});
