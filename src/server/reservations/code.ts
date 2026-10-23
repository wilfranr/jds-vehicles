import { randomInt } from 'node:crypto';

import { CODE_ALPHABET, CODE_PATTERN, CODE_SUFFIX_LENGTH } from './code-pattern';

export { CODE_ALPHABET, CODE_PATTERN, CODE_SUFFIX_LENGTH };

/** `RES-AAAA-XXXX`: año de la reserva y 4 caracteres aleatorios criptográficos (nunca `Math.random`). */
export function generateReservationCode(
  now: Date = new Date(),
  pick: (max: number) => number = (max) => randomInt(max)
): string {
  let suffix = '';
  for (let i = 0; i < CODE_SUFFIX_LENGTH; i++) suffix += CODE_ALPHABET[pick(CODE_ALPHABET.length)];
  return `RES-${now.getFullYear()}-${suffix}`;
}

/** Valida el código recibido en una URL antes de consultar la BD (devuelve `null` si no es un código válido). */
export function parseReservationCode(raw: string): string | null {
  return CODE_PATTERN.test(raw) ? raw : null;
}
