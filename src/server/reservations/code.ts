import { randomInt } from 'node:crypto';

/** Sin caracteres ambiguos (0/O, 1/I): se dicta por teléfono y WhatsApp. */
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_SUFFIX_LENGTH = 4;
export const CODE_PATTERN = /^RES-\d{4}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/;

/** `RES-AAAA-XXXX`: año de la reserva y 4 caracteres aleatorios criptográficos (nunca `Math.random`). */
export function generateReservationCode(
  now: Date = new Date(),
  pick: (max: number) => number = (max) => randomInt(max)
): string {
  let suffix = '';
  for (let i = 0; i < CODE_SUFFIX_LENGTH; i++) suffix += CODE_ALPHABET[pick(CODE_ALPHABET.length)];
  return `RES-${now.getFullYear()}-${suffix}`;
}
