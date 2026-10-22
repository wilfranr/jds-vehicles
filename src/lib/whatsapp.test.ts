import { describe, it, expect } from 'vitest';
import { buildWhatsAppUrl } from './whatsapp';

describe('buildWhatsAppUrl', () => {
  it('sanea números con signo más, espacios y caracteres especiales', () => {
    const url = buildWhatsAppUrl('+57 (320) 235-3168', 'Hola');
    expect(url).toBe('https://wa.me/573202353168?text=Hola');
  });

  it('codifica correctamente mensajes con tildes, signos y caracteres como &', () => {
    const message = '¡Hola JDS Vehículos! Quisiera información & asesoría.';
    const url = buildWhatsAppUrl('573202353168', message);
    expect(url).toBe(`https://wa.me/573202353168?text=${encodeURIComponent(message)}`);
    expect(url).toContain('%26'); // & codificado
    expect(url).toContain('%C3%AD'); // í codificada
  });

  it('funciona con números que ya vienen limpios', () => {
    const url = buildWhatsAppUrl('573001234567', 'Test');
    expect(url).toBe('https://wa.me/573001234567?text=Test');
  });
});
