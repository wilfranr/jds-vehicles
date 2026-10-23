import { describe, it, expect } from 'vitest';
import {
  buildReservationMessage,
  buildReservationWhatsAppUrl,
  buildStaffContactUrl,
  buildWhatsAppUrl,
} from './whatsapp';

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

describe('mensaje de reserva', () => {
  const data = {
    marca: 'Toyota',
    modelo: 'Corolla',
    codigo: 'RES-2026-AB2C',
    nombre: 'Carlos Gómez',
  };

  it('sigue la plantilla de la documentación con código, vehículo y nombre', () => {
    expect(buildReservationMessage(data)).toBe(
      'Hola JDS Vehículos, he reservado el auto Toyota Corolla (Código: RES-2026-AB2C). Mi nombre es Carlos Gómez y deseo continuar con el proceso.'
    );
  });

  it('sanea saltos de línea, espacios repetidos y longitudes excesivas', () => {
    const message = buildReservationMessage({
      ...data,
      nombre: `Ana\n\r  Pérez\t${'x'.repeat(500)}`,
    });
    expect(message).not.toMatch(/[\r\n\t]/);
    expect(message).toContain('Mi nombre es Ana Pérez xxx');
    expect(message.length).toBeLessThan(400);
  });

  it('no interpreta marcadores dentro de los valores', () => {
    expect(buildReservationMessage({ ...data, nombre: '{codigo}' })).toContain(
      'Mi nombre es {codigo} y'
    );
  });

  it('codifica el enlace hacia el número del concesionario', () => {
    const url = buildReservationWhatsAppUrl('+57 320 235 3168', data);
    expect(url.startsWith('https://wa.me/573202353168?text=')).toBe(true);
    expect(decodeURIComponent(url.split('text=')[1]!)).toBe(buildReservationMessage(data));
    expect(url).not.toMatch(/placa|documento/i);
  });
});

describe('enlace del personal al cliente', () => {
  it('va al teléfono del cliente con código, nombre y vehículo, sanitizado', () => {
    const url = buildStaffContactUrl('+57 (310) 555-1234', {
      nombre: 'Ana\nPérez',
      codigo: 'RES-2026-AB2C',
      marca: 'Toyota',
      modelo: 'Corolla',
    });
    expect(url.startsWith('https://wa.me/573105551234?text=')).toBe(true);
    const text = decodeURIComponent(url.split('?text=')[1]!);
    expect(text).toBe(
      'Hola Ana Pérez, te escribimos de JDS Vehículos por tu reserva RES-2026-AB2C del Toyota Corolla.'
    );
  });
});
