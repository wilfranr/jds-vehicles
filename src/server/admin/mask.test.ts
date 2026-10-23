import { describe, it, expect } from 'vitest';
import { maskDocument } from './mask';

describe('maskDocument', () => {
  it('deja visibles solo los 3 últimos caracteres', () => {
    expect(maskDocument('7712345678')).toBe('*******678');
    expect(maskDocument('ABC12345')).toBe('*****345');
  });

  it('documentos de 3 caracteres o menos se ocultan por completo', () => {
    expect(maskDocument('123')).toBe('***');
    expect(maskDocument('AB')).toBe('**');
    expect(maskDocument('')).toBe('');
  });

  it('conserva la longitud y no revela nada más', () => {
    const masked = maskDocument('1012345678');
    expect(masked).toHaveLength(10);
    expect(masked.slice(0, 7)).toBe('*******');
  });
});
