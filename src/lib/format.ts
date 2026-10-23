/**
 * Formatea un valor numérico como moneda colombiana (COP).
 * Ejemplo: formatCOP(115000000) -> "$ 115.000.000"
 */
export function formatCOP(amount: number): string {
  const formatted = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(amount);

  // Reemplazar espacios no divisibles por espacio simple y asegurar formato "$ 115.000.000"
  return formatted.replace(/\u00A0/g, ' ').trim();
}

/** Fecha y hora en español de Colombia (zona America/Bogota). Ejemplo: "23 oct 2026, 10:40 a. m." */
export function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Bogota',
  }).format(date);
}
