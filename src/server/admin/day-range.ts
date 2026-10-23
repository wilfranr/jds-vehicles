const BOGOTA_OFFSET_HOURS = 5; // UTC-5 todo el año

/** Inicio (00:00 de Bogotá) del día `AAAA-MM-DD`, o `null` si el texto no es una fecha real. */
export function parseDayStart(value: string | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day, BOGOTA_OFFSET_HOURS));
  const local = new Date(date.getTime() - BOGOTA_OFFSET_HOURS * 3_600_000);
  const real =
    local.getUTCFullYear() === year &&
    local.getUTCMonth() === month - 1 &&
    local.getUTCDate() === day;
  return real ? date : null;
}

export interface DayRange {
  /** Inicio del primer día (inclusive). */
  from: Date | null;
  /** Inicio del día SIGUIENTE al último incluido (exclusivo). */
  to: Date | null;
  /** `false` si alguna fecha no es válida o `desde` es posterior a `hasta`. */
  valid: boolean;
}

/** Rango de días (ambos extremos incluidos) para filtrar por fecha. Sin valores devuelve un rango abierto. */
export function parseDayRange(fromRaw: string | undefined, toRaw: string | undefined): DayRange {
  const from = fromRaw ? parseDayStart(fromRaw) : null;
  const lastDay = toRaw ? parseDayStart(toRaw) : null;
  if ((fromRaw && !from) || (toRaw && !lastDay)) return { from: null, to: null, valid: false };
  const to = lastDay ? new Date(lastDay.getTime() + 24 * 3_600_000) : null;
  if (from && lastDay && from.getTime() > lastDay.getTime()) {
    return { from: null, to: null, valid: false };
  }
  return { from, to, valid: true };
}
