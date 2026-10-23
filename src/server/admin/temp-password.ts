import { randomInt } from 'node:crypto';

// Sin caracteres ambiguos (0/O, 1/l/I) porque la contraseña se comunica por un canal humano.
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const DIGITS = '23456789';
const ALL = LETTERS + DIGITS;
export const TEMP_PASSWORD_LENGTH = 16;

/**
 * Contraseña temporal aleatoria (criptográfica) de 16 caracteres con al menos una letra y un dígito, de modo
 * que cumple la política de F2-02 (10–72 caracteres, letra y número, no común). `pick` es inyectable para pruebas.
 */
export function generateTemporaryPassword(
  pick: (max: number) => number = (max) => randomInt(max)
): string {
  const chars: string[] = [];
  for (let i = 0; i < TEMP_PASSWORD_LENGTH; i++) chars.push(ALL[pick(ALL.length)]!);
  // Garantiza la composición en posiciones aleatorias distintas.
  const letterAt = pick(TEMP_PASSWORD_LENGTH);
  let digitAt = pick(TEMP_PASSWORD_LENGTH);
  if (digitAt === letterAt) digitAt = (digitAt + 1) % TEMP_PASSWORD_LENGTH;
  chars[letterAt] = LETTERS[pick(LETTERS.length)]!;
  chars[digitAt] = DIGITS[pick(DIGITS.length)]!;
  return chars.join('');
}
