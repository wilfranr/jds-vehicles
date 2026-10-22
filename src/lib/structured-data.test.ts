import { describe, it, expect } from 'vitest';
import { Combustible, Condicion, Disponibilidad, Transmision } from '@prisma/client';
import type { VehicleDetailData } from '@/types/catalog';
import { buildVehicleJsonLd, serializeJsonLd } from './structured-data';

const vehicle: VehicleDetailData = {
  id: 7,
  marcaId: 1,
  marcaNombre: 'Toyota',
  modeloId: 2,
  modeloNombre: 'Hilux',
  anio: 2022,
  condicion: Condicion.USADO,
  precio: 150000000,
  kilometraje: 32000,
  transmision: Transmision.AUTOMATICA,
  combustible: Combustible.DIESEL,
  cilindraje: 2400,
  color: 'Blanco',
  disponibilidad: Disponibilidad.DISPONIBLE,
  fotoPrincipalUrl: 'https://images.unsplash.com/a.jpg',
  totalFotos: 1,
  descripcion: null,
  placaEnmascarada: '***123',
  fotos: [
    { id: 1, url: 'https://images.unsplash.com/a.jpg', esPrincipal: true, ordenPresentacion: 1 },
  ],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('buildVehicleJsonLd', () => {
  it('describe el vehículo y la oferta en COP', () => {
    const ld = buildVehicleJsonLd(vehicle, 'https://jds.example');
    expect(ld['@type']).toBe('Car');
    expect(ld.brand.name).toBe('Toyota');
    expect(ld.url).toBe('https://jds.example/vehiculos/7');
    expect(ld.offers).toMatchObject({
      price: 150000000,
      priceCurrency: 'COP',
      availability: 'https://schema.org/InStock',
    });
    expect(ld.itemCondition).toBe('https://schema.org/UsedCondition');
  });

  it('traduce la disponibilidad y omite la placa', () => {
    const reserved = buildVehicleJsonLd(
      { ...vehicle, disponibilidad: Disponibilidad.RESERVADO },
      'https://jds.example'
    );
    expect(reserved.offers.availability).toBe('https://schema.org/LimitedAvailability');
    expect(JSON.stringify(reserved)).not.toContain('***123');
  });
});

describe('serializeJsonLd', () => {
  it('escapa "<" para que no cierre el script', () => {
    const out = serializeJsonLd({ name: '</script><script>alert(1)</script>' });
    expect(out).not.toContain('<');
    expect(JSON.parse(out).name).toBe('</script><script>alert(1)</script>');
  });
});
