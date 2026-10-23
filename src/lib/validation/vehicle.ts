import { z } from 'zod';
import './zod-setup';

export const CONDICIONES = ['NUEVO', 'USADO'] as const;
export const TRANSMISIONES = ['MANUAL', 'AUTOMATICA', 'SECUENCIAL'] as const;
export const COMBUSTIBLES = ['GASOLINA', 'DIESEL', 'HIBRIDO', 'ELECTRICO', 'GAS'] as const;
/** Estados que el personal puede fijar a mano; `RESERVADO` y `VENDIDO` los producen los flujos de reserva y venta. */
export const MANUAL_DISPONIBILIDADES = ['DISPONIBLE', 'PROXIMAMENTE'] as const;

export const MIN_YEAR = 1950;
export const MAX_PRICE = 9_999_999_999.99;
const MAX_KM = 9_999_999;

/** Mensajes de validación (viven en `site-content.ts` y se inyectan: el esquema no lleva texto editorial). */
export interface VehicleMessages {
  modelo: string;
  anio: string;
  color: string;
  condicion: string;
  placa: string;
  placaRequired: string;
  placaNotForNew: string;
  precio: string;
  kilometraje: string;
  kilometrajeNew: string;
  transmision: string;
  combustible: string;
  cilindraje: string;
  descripcion: string;
  disponibilidad: string;
}

const CONTROL_CHARS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

/** Placa: sin espacios ni guiones, en mayúsculas. */
export function normalizePlate(value: string): string {
  return value.replace(/[\s-]/g, '').toUpperCase();
}

/**
 * Precio en pesos: solo dígitos con hasta dos decimales con punto (sin separadores de miles).
 * Se maneja como texto/`Decimal` para no introducir errores de coma flotante; devuelve la cadena normalizada.
 */
export function parsePrice(value: string): string | null {
  const trimmed = value.trim();
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(trimmed)) return null;
  const numeric = Number(trimmed);
  if (!(numeric > 0) || numeric > MAX_PRICE) return null;
  const [whole = '0', decimals = ''] = trimmed.split('.');
  return `${whole.replace(/^0+(?=\d)/, '')}.${decimals.padEnd(2, '0')}`;
}

function optionalInt(min: number, max: number, message: string) {
  return z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (v === '') return undefined;
      if (!/^\d{1,9}$/.test(v) || Number(v) < min || Number(v) > max) {
        ctx.addIssue({ code: 'custom', message });
        return z.NEVER;
      }
      return Number(v);
    })
    .optional()
    .transform((v) => v);
}

/** Esquema único de vehículo (crear y editar): reglas de negocio de `docs/DOCUMENTACION.md` §1.1. */
export function createVehicleSchema(m: VehicleMessages, now: () => Date = () => new Date()) {
  const maxYear = now().getFullYear() + 1;

  return z
    .object({
      modeloId: z
        .string(m.modelo)
        .trim()
        .regex(/^[1-9]\d{0,9}$/, m.modelo)
        .transform(Number),
      anio: z
        .string(m.anio)
        .trim()
        .regex(/^\d{4}$/, m.anio)
        .transform(Number)
        .refine((v) => v >= MIN_YEAR && v <= maxYear, m.anio),
      color: z
        .string(m.color)
        .transform((v) => v.trim())
        .pipe(z.string().min(2, m.color).max(50, m.color)),
      condicion: z.enum(CONDICIONES, m.condicion),
      placa: z
        .string()
        .max(30, m.placa)
        .transform(normalizePlate)
        .pipe(z.string().regex(/^([A-Z0-9]{5,10})?$/, m.placa))
        .optional()
        .transform((v) => (v ? v : undefined)),
      precio: z.string(m.precio).transform((v, ctx) => {
        const parsed = parsePrice(v);
        if (parsed === null) {
          ctx.addIssue({ code: 'custom', message: m.precio });
          return z.NEVER;
        }
        return parsed;
      }),
      kilometraje: z
        .string(m.kilometraje)
        .trim()
        .regex(/^\d{1,7}$/, m.kilometraje)
        .transform(Number)
        .refine((v) => v >= 0 && v <= MAX_KM, m.kilometraje),
      transmision: z.enum(TRANSMISIONES, m.transmision),
      combustible: z.enum(COMBUSTIBLES, m.combustible),
      cilindraje: optionalInt(50, 10000, m.cilindraje),
      descripcion: z
        .string()
        .max(2200, m.descripcion)
        .transform((v) => v.trim())
        .pipe(
          z
            .string()
            .max(2000, m.descripcion)
            .refine((v) => !CONTROL_CHARS.test(v), m.descripcion)
        )
        .optional()
        .transform((v) => (v ? v : undefined)),
      disponibilidad: z.enum(MANUAL_DISPONIBILIDADES, m.disponibilidad),
    })
    .superRefine((data, ctx) => {
      if (data.condicion === 'USADO' && !data.placa) {
        ctx.addIssue({ code: 'custom', path: ['placa'], message: m.placaRequired });
      }
      if (data.condicion === 'NUEVO') {
        if (data.placa)
          ctx.addIssue({ code: 'custom', path: ['placa'], message: m.placaNotForNew });
        if (data.kilometraje !== 0) {
          ctx.addIssue({ code: 'custom', path: ['kilometraje'], message: m.kilometrajeNew });
        }
      }
    });
}

export type VehicleInput = z.output<ReturnType<typeof createVehicleSchema>>;
export type VehicleField = keyof VehicleInput;

/** Los únicos campos que se leen del formulario; cualquier otro (`id`, `visibleCatalogo`…) se descarta. */
export const VEHICLE_FIELDS = [
  'modeloId',
  'anio',
  'color',
  'condicion',
  'placa',
  'precio',
  'kilometraje',
  'transmision',
  'combustible',
  'cilindraje',
  'descripcion',
  'disponibilidad',
] as const satisfies readonly VehicleField[];
