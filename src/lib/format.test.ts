import { describe, it, expect } from 'vitest';
import { formatCOP, formatExactCOP } from './format';

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

describe('formatExactCOP', () => {
  it('formatea decimales exactos sin coma flotante', () => {
    expect(formatExactCOP('115000000.00')).toBe('$ 115.000.000');
    expect(formatExactCOP('115000000.50')).toBe('$ 115.000.000,50');
    expect(formatExactCOP('0.10')).toBe('$ 0,10');
    expect(formatExactCOP('9999999999.99')).toBe('$ 9.999.999.999,99');
    expect(formatExactCOP('950')).toBe('$ 950');
  });

  it('la suma de decimales que en flotante falla (0.1 + 0.2) se muestra exacta', () => {
    expect(formatExactCOP('0.30')).toBe('$ 0,30');
  });
});
