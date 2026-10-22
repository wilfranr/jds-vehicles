import { describe, it, expect } from 'vitest';
import { formatCOP } from './format';

describe('formatCOP', () => {
  it('formatea correctamente cifras en pesos colombianos', () => {
    const result = formatCOP(115000000);
    // En es-CO el formato estándar con Intl.NumberFormat es "$ 115.000.000"
    expect(result).toMatch(/\$\s?115\.000\.000/);
  });

  it('formatea cero correctamente', () => {
    const result = formatCOP(0);
    expect(result).toMatch(/\$\s?0/);
  });
});
