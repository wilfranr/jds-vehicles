/**
 * Sanea un número de teléfono dejando solo dígitos
 * y construye la URL directa a la API de WhatsApp (wa.me) con mensaje codificado.
 */
export function buildWhatsAppUrl(phone: string, message: string): string {
  const sanitizedPhone = phone.replace(/\D/g, '');
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${sanitizedPhone}?text=${encodedMessage}`;
}
