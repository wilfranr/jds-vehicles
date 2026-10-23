import { z } from 'zod';
import { createNotesSchema } from './reservation-admin';
import { parsePrice } from './vehicle';

export const PAYMENT_METHODS = ['TRANSFERENCIA', 'EFECTIVO', 'CREDITO', 'MIXTO'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export interface SaleMessages {
  price: string;
  method: string;
  notes: string;
  confirm: string;
}

/**
 * Campos que el servidor lee del formulario de «Registrar venta»: precio final, método de pago, observaciones y la
 * casilla de confirmación. El comprador y el vendedor NO están aquí: salen de la reserva y de la sesión.
 */
export function createSaleSchema(m: SaleMessages) {
  return z.object({
    precio: z.string(m.price).transform((v, ctx) => {
      const parsed = parsePrice(v);
      if (parsed === null) {
        ctx.addIssue({ code: 'custom', message: m.price });
        return z.NEVER;
      }
      return parsed;
    }),
    metodoPago: z.enum(PAYMENT_METHODS, m.method),
    observaciones: createNotesSchema({ notes: m.notes, reason: m.notes }).transform((v) =>
      v === '' ? undefined : v
    ),
    confirmar: z.literal('on', m.confirm),
  });
}

export type SaleInput = z.output<ReturnType<typeof createSaleSchema>>;

/** `VTA-AAAA-NNNNNN` (año y consecutivo anual de 6 dígitos). */
export const RECEIPT_PATTERN = /^VTA-\d{4}-\d{6}$/;

export function parseReceipt(raw: string): string | null {
  return RECEIPT_PATTERN.test(raw) ? raw : null;
}

/** Recibo `VTA-AAAA-NNNNNN` a partir del año y el número de orden. */
export function formatReceipt(year: number, sequence: number): string {
  return `VTA-${year}-${String(sequence).padStart(6, '0')}`;
}

/** Extrae el consecutivo de un recibo del año indicado (o `null` si no corresponde). */
export function receiptSequence(receipt: string, year: number): number | null {
  const match = /^VTA-(\d{4})-(\d{6})$/.exec(receipt);
  if (!match || Number(match[1]) !== year) return null;
  return Number(match[2]);
}
