import { z } from 'zod';
import './zod-setup';

export interface ReservationNotesMessages {
  notes: string;
  reason: string;
}

const CONTROL_CHARS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

function plainText(max: number, message: string) {
  return z
    .string(message)
    .max(max + 200, message)
    .transform((v) => v.trim())
    .pipe(
      z
        .string()
        .max(max, message)
        .refine((v) => !CONTROL_CHARS.test(v), message)
    );
}

/** Observaciones internas: texto plano de hasta 1000 caracteres (puede quedar vacío para borrarlas). */
export const NOTES_MAX = 1000;
export const REASON_MAX = 300;

export function createNotesSchema(m: ReservationNotesMessages) {
  return plainText(NOTES_MAX, m.notes);
}

/** Motivo de cancelación: texto plano de hasta 300 caracteres, opcional. */
export function createReasonSchema(m: ReservationNotesMessages) {
  return plainText(REASON_MAX, m.reason);
}
