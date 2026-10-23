import { describe, it, expect } from 'vitest';
import { siteContent } from '@/lib/site-content';
import { createSaleSchema, formatReceipt, parseReceipt, receiptSequence } from './sale';

const e = siteContent.adminSales.errors;
const schema = createSaleSchema({
  price: e.price,
  method: e.method,
  notes: e.notes,
  confirm: e.confirm,
});
const valid = {
  precio: '115000000',
  metodoPago: 'TRANSFERENCIA',
  observaciones: '',
  confirmar: 'on',
};

function errors(overrides: Record<string, unknown>) {
  const result = schema.safeParse({ ...valid, ...overrides });
  if (result.success) return {};
  return Object.fromEntries(result.error.issues.map((i) => [String(i.path[0]), i.message]));
}

describe('esquema de venta', () => {
  it('normaliza el precio a decimal exacto y las observaciones vacías a undefined', () => {
    const result = schema.safeParse(valid);
    expect(result.success && result.data).toEqual({
      precio: '115000000.00',
      metodoPago: 'TRANSFERENCIA',
      observaciones: undefined,
      confirmar: 'on',
    });
  });

  it('acepta decimales con punto y los cuatro métodos de pago', () => {
    expect(schema.parse({ ...valid, precio: '99999.5' }).precio).toBe('99999.50');
    for (const metodoPago of ['TRANSFERENCIA', 'EFECTIVO', 'CREDITO', 'MIXTO']) {
      expect(schema.safeParse({ ...valid, metodoPago }).success).toBe(true);
    }
  });

  it.each([
    '0',
    '0.00',
    '-1',
    '',
    'abc',
    '1e6',
    '1.234.567',
    '1,5',
    '1.999',
    '10000000000',
    ' ',
    '12 34',
  ])('rechaza el precio %j', (precio) => {
    expect(errors({ precio })).toHaveProperty('precio', e.price);
  });

  it.each(['CHEQUE', 'transferencia', '', 'DROP TABLE', undefined])(
    'rechaza el método %j',
    (metodoPago) => {
      expect(errors({ metodoPago })).toHaveProperty('metodoPago');
    }
  );

  it('observaciones: hasta 1000 caracteres de texto plano', () => {
    expect(errors({ observaciones: 'x'.repeat(1000) })).not.toHaveProperty('observaciones');
    expect(errors({ observaciones: 'x'.repeat(1001) })).toHaveProperty('observaciones', e.notes);
    expect(errors({ observaciones: 'a\u0000b' })).toHaveProperty('observaciones');
  });

  it('exige la casilla de confirmación', () => {
    expect(errors({ confirmar: undefined })).toHaveProperty('confirmar', e.confirm);
    expect(errors({ confirmar: 'yes' })).toHaveProperty('confirmar');
  });

  it('el comprador y el vendedor no forman parte del esquema: se descartan', () => {
    const result = schema.safeParse({
      ...valid,
      compradorId: '9',
      vendedorId: '9',
      vendedorUsuarioId: '9',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty('compradorId');
      expect(result.data).not.toHaveProperty('vendedorUsuarioId');
    }
  });
});

describe('número de recibo', () => {
  it('formato VTA-AAAA-NNNNNN', () => {
    expect(formatReceipt(2026, 1)).toBe('VTA-2026-000001');
    expect(formatReceipt(2026, 123456)).toBe('VTA-2026-123456');
    expect(parseReceipt('VTA-2026-000001')).toBe('VTA-2026-000001');
    for (const bad of [
      'VTA-26-1',
      'vta-2026-000001',
      'VTA-2026-00001',
      '../',
      'VTA-2026-000001\n',
      '',
    ]) {
      expect(parseReceipt(bad), bad).toBeNull();
    }
  });

  it('el consecutivo solo cuenta dentro del mismo año', () => {
    expect(receiptSequence('VTA-2026-000041', 2026)).toBe(41);
    expect(receiptSequence('VTA-2025-000041', 2026)).toBeNull();
    expect(receiptSequence('basura', 2026)).toBeNull();
  });
});
