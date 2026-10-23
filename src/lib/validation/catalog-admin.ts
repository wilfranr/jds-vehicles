import { z } from 'zod';
import './zod-setup';

export interface NameMessages {
  name: string;
  brand: string;
}

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

/** Nombre de marca o modelo: texto plano de 1 a 100 caracteres, recortado. */
export function createNameSchema(m: NameMessages) {
  return z
    .string(m.name)
    .max(150, m.name)
    .transform((v) => v.trim().replace(/\s+/g, ' '))
    .pipe(
      z
        .string()
        .min(1, m.name)
        .max(100, m.name)
        .refine((v) => !CONTROL_CHARS.test(v), m.name)
    );
}

export function createIdSchema(message: string) {
  return z
    .string(message)
    .trim()
    .regex(/^[1-9]\d{0,9}$/, message)
    .transform(Number);
}
