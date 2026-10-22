import { z } from 'zod';
import { Condicion, Transmision, Combustible, Disponibilidad } from '@prisma/client';
import { type VehicleSortOption } from '@/types/catalog';

// Helper para convertir string a número entero positivo de forma segura
const safePositiveInt = z
  .string()
  .optional()
  .transform((val) => {
    if (!val || typeof val !== 'string') return undefined;
    const trimmed = val.trim();
    if (!trimmed) return undefined;
    const parsed = Number(trimmed);
    return !Number.isNaN(parsed) && parsed > 0 ? Math.floor(parsed) : undefined;
  });

// Helper para texto limpio con límite
const safeCleanString = (maxLength: number) =>
  z
    .string()
    .optional()
    .transform((val) => {
      if (!val || typeof val !== 'string') return undefined;
      const trimmed = val.trim();
      return trimmed.length > 0 ? trimmed.slice(0, maxLength) : undefined;
    });

export const rawCatalogFiltersSchema = z.object({
  q: safeCleanString(80),
  marca: safePositiveInt,
  modelo: safePositiveInt,
  condicion: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      const upper = val.trim().toUpperCase();
      if (upper === Condicion.NUEVO || upper === Condicion.USADO) {
        return upper as Condicion;
      }
      return undefined;
    }),
  precioMin: safePositiveInt,
  precioMax: safePositiveInt,
  anioMin: safePositiveInt,
  anioMax: safePositiveInt,
  color: safeCleanString(40),
  transmision: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      const upper = val.trim().toUpperCase();
      if (
        upper === Transmision.AUTOMATICA ||
        upper === Transmision.MANUAL ||
        upper === Transmision.SECUENCIAL
      ) {
        return upper as Transmision;
      }
      return undefined;
    }),
  combustible: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      const upper = val.trim().toUpperCase();
      if (
        upper === Combustible.GASOLINA ||
        upper === Combustible.DIESEL ||
        upper === Combustible.HIBRIDO ||
        upper === Combustible.ELECTRICO
      ) {
        return upper as Combustible;
      }
      return undefined;
    }),
  orden: z
    .string()
    .optional()
    .transform((val): VehicleSortOption => {
      if (!val) return 'recientes';
      const clean = val.trim().toLowerCase();
      if (
        clean === 'precio_asc' ||
        clean === 'precio_desc' ||
        clean === 'anio_desc' ||
        clean === 'recientes'
      ) {
        return clean as VehicleSortOption;
      }
      return 'recientes';
    }),
  pagina: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return 1;
      const parsed = Number(val.trim());
      return !Number.isNaN(parsed) && parsed >= 1 ? Math.floor(parsed) : 1;
    }),
  disponibilidad: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      const upper = val.trim().toUpperCase();
      if (
        upper === Disponibilidad.DISPONIBLE ||
        upper === Disponibilidad.RESERVADO ||
        upper === Disponibilidad.PROXIMAMENTE
      ) {
        return upper as Disponibilidad;
      }
      return undefined;
    }),
});

export type RawCatalogFiltersInput =
  Record<string, string | string[] | undefined> | URLSearchParams;

export interface NormalizedCatalogFilters {
  q?: string;
  marca?: number;
  modelo?: number;
  condicion?: Condicion;
  precioMin?: number;
  precioMax?: number;
  anioMin?: number;
  anioMax?: number;
  color?: string;
  transmision?: Transmision;
  combustible?: Combustible;
  orden: VehicleSortOption;
  pagina: number;
  disponibilidad?: Disponibilidad;
}

/**
 * Parsea y normaliza parámetros de búsqueda de catálogo de forma tolerante a fallos:
 * - Nunca lanza error ni produce HTTP 500 ante entradas malformadas.
 * - Si precioMin > precioMax, intercambia los valores.
 * - Si anioMin > anioMax, intercambia los valores.
 * - La página siempre es >= 1 (por defecto 1).
 * - Orden siempre es válido (por defecto 'recientes').
 */
export function parseCatalogFilters(input?: RawCatalogFiltersInput): NormalizedCatalogFilters {
  const plainObject: Record<string, string | undefined> = {};

  if (input instanceof URLSearchParams) {
    for (const [key, value] of input.entries()) {
      plainObject[key] = value;
    }
  } else if (input && typeof input === 'object') {
    for (const [key, value] of Object.entries(input)) {
      if (Array.isArray(value)) {
        plainObject[key] = value[0];
      } else if (typeof value === 'string') {
        plainObject[key] = value;
      }
    }
  }

  const result = rawCatalogFiltersSchema.safeParse(plainObject);

  const parsed: z.infer<typeof rawCatalogFiltersSchema> = result.success
    ? result.data
    : {
        q: undefined,
        marca: undefined,
        modelo: undefined,
        condicion: undefined,
        precioMin: undefined,
        precioMax: undefined,
        anioMin: undefined,
        anioMax: undefined,
        color: undefined,
        transmision: undefined,
        combustible: undefined,
        orden: 'recientes' as const,
        pagina: 1,
        disponibilidad: undefined,
      };

  let { precioMin, precioMax, anioMin, anioMax } = parsed;

  // Intercambiar si min > max
  if (precioMin !== undefined && precioMax !== undefined && precioMin > precioMax) {
    const temp = precioMin;
    precioMin = precioMax;
    precioMax = temp;
  }

  if (anioMin !== undefined && anioMax !== undefined && anioMin > anioMax) {
    const temp = anioMin;
    anioMin = anioMax;
    anioMax = temp;
  }

  return {
    q: parsed.q,
    marca: parsed.marca,
    modelo: parsed.modelo,
    condicion: parsed.condicion,
    precioMin,
    precioMax,
    anioMin,
    anioMax,
    color: parsed.color,
    transmision: parsed.transmision,
    combustible: parsed.combustible,
    orden: parsed.orden || 'recientes',
    pagina: parsed.pagina || 1,
    disponibilidad: parsed.disponibilidad,
  };
}
