/**
 * Tope de reservas activas (`PENDIENTE_CONTACTO` o `EN_NEGOCIACION`) por usuario: evita que una sola cuenta
 * bloquee el inventario. Único lugar donde se define.
 * TODO(owner): confirmar el valor (2 es un valor provisional).
 */
export const MAX_ACTIVE_RESERVATIONS_PER_USER = 2;

/**
 * Horas de vigencia de una reserva, desde `RESERVA_EXPIRACION_HORAS` (entero positivo).
 * Sin la variable no hay expiración (`null`): el plazo lo decide el propietario y no se inventa uno por defecto.
 * Lanza un error claro si el valor no es un entero positivo.
 */
export function parseReservationExpirationHours(
  env: Record<string, string | undefined> = process.env
): number | null {
  const raw = env.RESERVA_EXPIRACION_HORAS?.trim();
  if (!raw) return null;
  if (!/^[1-9]\d{0,5}$/.test(raw)) {
    throw new Error(
      `RESERVA_EXPIRACION_HORAS debe ser un entero positivo de horas (por ejemplo 24); se recibió "${raw}". Déjala vacía para que las reservas no expiren.`
    );
  }
  return Number(raw);
}

/** Valida la configuración de reservas al arrancar el servidor (no durante `next build`). */
export function assertReservationEnv(env: Record<string, string | undefined> = process.env): void {
  if (env.NEXT_PHASE === 'phase-production-build') return;
  parseReservationExpirationHours(env);
}

export function expirationDate(now: Date, hours: number | null): Date | null {
  return hours === null ? null : new Date(now.getTime() + hours * 60 * 60 * 1000);
}
