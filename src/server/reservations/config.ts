/**
 * Tope de reservas activas (`PENDIENTE_CONTACTO` o `EN_NEGOCIACION`) por usuario: evita que una sola cuenta
 * bloquee el inventario. Único lugar donde se define.
 * TODO(owner): confirmar el valor (2 es un valor provisional).
 */
export const MAX_ACTIVE_RESERVATIONS_PER_USER = 2;

/**
 * Horas de vigencia por defecto de una reserva (decisión del propietario para el demo).
 * TODO(owner): confirmar antes de producción.
 */
export const DEFAULT_RESERVATION_EXPIRY_HOURS = 48;

/**
 * Horas de vigencia de una reserva. `RESERVA_EXPIRACION_HORAS` (entero positivo) tiene prioridad; sin ella se
 * usa `DEFAULT_RESERVATION_EXPIRY_HOURS`; el valor `0` desactiva la expiración (`null`).
 * Lanza un error claro si el valor no es un entero no negativo.
 */
export function parseReservationExpirationHours(
  env: Record<string, string | undefined> = process.env
): number | null {
  const raw = env.RESERVA_EXPIRACION_HORAS?.trim();
  if (!raw) return DEFAULT_RESERVATION_EXPIRY_HOURS;
  if (raw === '0') return null;
  if (!/^[1-9]\d{0,5}$/.test(raw)) {
    throw new Error(
      `RESERVA_EXPIRACION_HORAS debe ser un entero de horas (por ejemplo 24), o 0 para que no expiren; se recibió "${raw}". Déjala vacía para usar ${DEFAULT_RESERVATION_EXPIRY_HOURS} horas.`
    );
  }
  return Number(raw);
}

export function expirationDate(now: Date, hours: number | null): Date | null {
  return hours === null ? null : new Date(now.getTime() + hours * 60 * 60 * 1000);
}
