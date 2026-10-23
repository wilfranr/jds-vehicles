import { z } from 'zod';

const MAX_UNSIGNED_INT = 4294967295;

/**
 * Valida de forma estricta que un string represente un identificador entero positivo
 * dentro del rango UNSIGNED INT de MySQL (1 .. 4294967295).
 * Descarta valores no numéricos, flotantes (ej. "1.5"), exponenciales (ej. "1e3"),
 * enteros negativos, cero y números fuera de rango.
 */
export function parseVehicleId(rawId: string): number | null {
  if (!/^[1-9]\d{0,9}$/.test(rawId)) {
    return null;
  }
  const parsed = Number(rawId);
  if (!Number.isSafeInteger(parsed) || parsed > MAX_UNSIGNED_INT) {
    return null;
  }
  return parsed;
}

/** Esquema Zod de un id entero positivo del rango UNSIGNED INT (para ids enlazados a una acción). */
export function vehicleIdSchemaFor(message: string) {
  return z.number(message).int(message).min(1, message).max(MAX_UNSIGNED_INT, message);
}
