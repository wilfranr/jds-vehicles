/**
 * Enmascara un documento de identidad para el panel: solo se ven los 3 últimos caracteres
 * (`7712345678` → `*******678`). Única definición; la usan las reservas y los usuarios del panel.
 */
export function maskDocument(document: string): string {
  if (document.length <= 3) return '*'.repeat(document.length);
  return `${'*'.repeat(document.length - 3)}${document.slice(-3)}`;
}
