import { describe, expect, it } from 'vitest';
import { parseVehicleId, vehicleIdSchemaFor } from './vehicle-id';

describe('parseVehicleId', () => {
  it('acepta enteros positivos del rango UNSIGNED INT', () => {
    expect(parseVehicleId('1')).toBe(1);
    expect(parseVehicleId('4294967295')).toBe(4294967295);
  });
  it('rechaza todo lo demás', () => {
    for (const bad of [
      '0',
      '01',
      '-1',
      '1.5',
      '1e3',
      ' 1',
      '1 ',
      'abc',
      '',
      '4294967296',
      '99999999999',
    ]) {
      expect(parseVehicleId(bad), bad).toBeNull();
    }
  });
});

describe('vehicleIdSchemaFor', () => {
  const schema = vehicleIdSchemaFor('id inválido');
  it('valida enteros en rango y rechaza el resto con el mensaje dado', () => {
    expect(schema.safeParse(5).success).toBe(true);
    for (const bad of [0, -1, 1.5, 4294967296, '5']) {
      const result = schema.safeParse(bad);
      expect(result.success, String(bad)).toBe(false);
    }
    expect(schema.safeParse(0).error?.issues[0]?.message).toBe('id inválido');
  });
});
