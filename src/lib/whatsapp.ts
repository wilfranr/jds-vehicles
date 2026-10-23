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

const MAX_FIELD_LENGTH = 100;

/** Una sola línea, sin espacios repetidos y con longitud acotada (los valores vienen de la BD o del usuario). */
function sanitizeField(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, MAX_FIELD_LENGTH);
}

export interface ReservationMessageData {
  marca: string;
  modelo: string;
  codigo: string;
  nombre: string;
}

/** Mensaje de WhatsApp de una reserva (plantilla en `site-content.ts`). Nunca incluye placa ni documento. */
export function buildReservationMessage(data: ReservationMessageData): string {
  const values: Record<string, string> = {
    marca: sanitizeField(data.marca),
    modelo: sanitizeField(data.modelo),
    codigo: sanitizeField(data.codigo),
    nombre: sanitizeField(data.nombre),
  };
  return siteContent.reservations.whatsappMessage.replace(
    /\{(marca|modelo|codigo|nombre)\}/g,
    (_match, key: string) => values[key] ?? ''
  );
}

/** Enlace `wa.me` de una reserva hacia el número del concesionario. */
export function buildReservationWhatsAppUrl(phone: string, data: ReservationMessageData): string {
  return buildWhatsAppUrl(phone, buildReservationMessage(data));
}
