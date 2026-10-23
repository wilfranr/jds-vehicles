import { describe, it, expect } from 'vitest';
import { siteContent } from '@/lib/site-content';
import { createPasswordRule } from '@/lib/validation/register';
import { generateTemporaryPassword, TEMP_PASSWORD_LENGTH } from './temp-password';

const rule = createPasswordRule(siteContent.registro.errors);

describe('generateTemporaryPassword', () => {
  it('siempre cumple la política de contraseñas (longitud, letra y dígito, no común)', () => {
    for (let i = 0; i < 2000; i++) {
      const password = generateTemporaryPassword();
      expect(password).toHaveLength(TEMP_PASSWORD_LENGTH);
      expect(rule.safeParse(password).success, password).toBe(true);
    }
  });

  it('no usa caracteres ambiguos y es distinta en cada llamada', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const password = generateTemporaryPassword();
      expect(password).not.toMatch(/[0O1lI]/);
      seen.add(password);
    }
    expect(seen.size).toBe(500);
  });

  it('cumple la composición incluso con un generador degenerado', () => {
    for (const fixed of [0, 5, 49]) {
      const password = generateTemporaryPassword((max) => Math.min(fixed, max - 1));
      expect(password).toMatch(/[A-Za-z]/);
      expect(password).toMatch(/\d/);
    }
  });
});
