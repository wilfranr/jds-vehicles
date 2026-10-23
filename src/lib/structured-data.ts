import { Condicion, Disponibilidad } from '@prisma/client';
import type { VehicleDetailData } from '@/types/catalog';

const AVAILABILITY: Record<Disponibilidad, string> = {
  [Disponibilidad.DISPONIBLE]: 'https://schema.org/InStock',
  [Disponibilidad.RESERVADO]: 'https://schema.org/LimitedAvailability',
  [Disponibilidad.PROXIMAMENTE]: 'https://schema.org/PreOrder',
  [Disponibilidad.VENDIDO]: 'https://schema.org/SoldOut',
};

/**
 * Construye el JSON-LD `Car` (subtipo de `Vehicle`) del detalle de un vehículo.
 * `baseUrl` es el origen público del sitio (sin barra final) y se usa para URLs absolutas.
 */
export function buildVehicleJsonLd(vehicle: VehicleDetailData, baseUrl: string) {
  const name = `${vehicle.marcaNombre} ${vehicle.modeloNombre} ${vehicle.anio}`;
  const url = `${baseUrl}/vehiculos/${vehicle.id}`;

  return {
    '@context': 'https://schema.org',
    '@type': 'Car',
    name,
    url,
    brand: { '@type': 'Brand', name: vehicle.marcaNombre },
    model: vehicle.modeloNombre,
    vehicleModelDate: String(vehicle.anio),
    itemCondition:
      vehicle.condicion === Condicion.NUEVO
        ? 'https://schema.org/NewCondition'
        : 'https://schema.org/UsedCondition',
    color: vehicle.color,
    mileageFromOdometer: {
      '@type': 'QuantitativeValue',
      value: vehicle.kilometraje,
      unitCode: 'KMT',
    },
    fuelType: vehicle.combustible,
    vehicleTransmission: vehicle.transmision,
    ...(vehicle.cilindraje
      ? {
          vehicleEngine: {
            '@type': 'EngineSpecification',
            engineDisplacement: {
              '@type': 'QuantitativeValue',
              value: vehicle.cilindraje,
              unitCode: 'CMQ',
            },
          },
        }
      : {}),
    // Las fotos subidas desde el panel son rutas relativas (`/media/…`): el JSON-LD necesita URLs absolutas.
    ...(vehicle.fotos.length > 0
      ? { image: vehicle.fotos.map((f) => (f.url.startsWith('/') ? `${baseUrl}${f.url}` : f.url)) }
      : {}),
    ...(vehicle.descripcion ? { description: vehicle.descripcion } : {}),
    offers: {
      '@type': 'Offer',
      url,
      price: vehicle.precio,
      priceCurrency: 'COP',
      availability: AVAILABILITY[vehicle.disponibilidad],
    },
  };
}

/**
 * Serializa JSON-LD para inyectarlo en un `<script>`: escapa `<` (y los separadores de línea
 * U+2028/U+2029) para que ningún dato pueda cerrar la etiqueta ni romper el script.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replaceAll('<', '\\u003c')
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029');
}
