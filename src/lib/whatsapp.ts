import { siteContent } from '@/lib/site-content';

/**
 * Sanea un número de teléfono dejando solo dígitos
 * y construye la URL directa a la API de WhatsApp (wa.me) con mensaje codificado.
 */
export function buildWhatsAppUrl(phone: string, message: string): string {
  const sanitizedPhone = phone.replace(/\D/g, '');
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${sanitizedPhone}?text=${encodedMessage}`;
}

/**
 * Número de WhatsApp disponible en el cliente (variable pública o respaldo de `site-content`).
 * Las pantallas de error no pueden leer la configuración de la base de datos.
 */
export function getPublicWhatsAppNumber(): string {
  return (
    process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || siteContent.defaultFallbackSocials.whatsappNumber
  );
}
