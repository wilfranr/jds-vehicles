import { describe, it, expect } from 'vitest';
import {
  buildEditRaw,
  canChangeVisibility,
  currentAsRaw,
  editableData,
  rawFromForm,
  vehicleLock,
  type AdminVehicleDetail,
} from './vehicle-rules';
import { createVehicleSchema } from '@/lib/validation/vehicle';
import { siteContent } from '@/lib/site-content';

const current: AdminVehicleDetail = {
  id: 7,
  modeloId: 3,
  marcaId: 2,
  marcaNombre: 'Mazda',
  modeloNombre: 'CX-30',
  anio: 2022,
  color: 'Rojo',
  condicion: 'USADO',
  placa: 'ABC123',
  precio: '92000000.00',
  kilometraje: 24500,
  transmision: 'AUTOMATICA',
  combustible: 'GASOLINA',
  cilindraje: 2000,
  descripcion: 'Original',
  disponibilidad: 'DISPONIBLE',
  visibleCatalogo: true,
  hasActiveReservation: false,
};

const e = siteContent.adminVehicles.errors;
const schema = createVehicleSchema(
  {
    modelo: e.modelo,
    anio: e.anio,
    color: e.color,
    condicion: e.condicion,
    placa: e.placa,
    placaRequired: e.placaRequired,
    placaNotForNew: e.placaNotForNew,
    precio: e.precio,
    kilometraje: e.kilometraje,
    kilometrajeNew: e.kilometrajeNew,
    transmision: e.transmision,
    combustible: e.combustible,
    cilindraje: e.cilindraje,
    descripcion: e.descripcion,
    disponibilidad: e.disponibilidad,
  },
  () => new Date('2026-10-23T00:00:00Z')
);

const hostile = {
  ...currentAsRaw(current),
  id: '999',
  visibleCatalogo: 'false',
  modeloId: '1',
  placa: 'HACK999',
  condicion: 'NUEVO',
  kilometraje: '0',
  disponibilidad: 'PROXIMAMENTE',
  precio: '1000',
  descripcion: 'Nueva',
};

describe('vehicleLock', () => {
  it('sold / reserved / none', () => {
    expect(vehicleLock({ disponibilidad: 'VENDIDO', hasActiveReservation: false })).toBe('sold');
    expect(vehicleLock({ disponibilidad: 'RESERVADO', hasActiveReservation: false })).toBe(
      'reserved'
    );
    expect(vehicleLock({ disponibilidad: 'DISPONIBLE', hasActiveReservation: true })).toBe(
      'reserved'
    );
    expect(vehicleLock({ disponibilidad: 'PROXIMAMENTE', hasActiveReservation: false })).toBe(
      'none'
    );
  });
});

describe('rawFromForm', () => {
  it('solo lee los campos del esquema: id, visibleCatalogo y otros se descartan', () => {
    const form = new FormData();
    for (const [k, v] of Object.entries(hostile)) form.set(k, v);
    const raw = rawFromForm(form);
    expect(raw).not.toHaveProperty('id');
    expect(raw).not.toHaveProperty('visibleCatalogo');
    expect(Object.keys(raw).sort()).toEqual(
      [
        'anio',
        'color',
        'combustible',
        'cilindraje',
        'condicion',
        'descripcion',
        'disponibilidad',
        'kilometraje',
        'modeloId',
        'placa',
        'precio',
        'transmision',
      ].sort()
    );
  });
});

describe('edición con bloqueo', () => {
  it('sin bloqueo todo viene del formulario', () => {
    const raw = buildEditRaw(current, hostile, 'none');
    expect(raw.placa).toBe('HACK999');
    expect(raw.disponibilidad).toBe('PROXIMAMENTE');
  });

  it('con reserva activa solo se toman precio y descripción; lo demás se ignora y sale de la BD', () => {
    const parsed = schema.safeParse(buildEditRaw(current, hostile, 'reserved'));
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(editableData('reserved', parsed.data)).toEqual({
      precio: '1000.00',
      descripcion: 'Nueva',
    });
    // lo crítico se validó con los valores actuales, no con los del formulario
    expect(parsed.data).toMatchObject({ modeloId: 3, placa: 'ABC123', condicion: 'USADO' });
  });

  it('vendido: no hay datos que escribir', () => {
    const parsed = schema.safeParse(buildEditRaw(current, hostile, 'sold'));
    expect(parsed.success && editableData('sold', parsed.data)).toBeNull();
  });

  it('editableData sin bloqueo lista explícitamente los campos (sin visibleCatalogo ni id)', () => {
    const parsed = schema.safeParse(buildEditRaw(current, hostile, 'none'));
    expect(parsed.success).toBe(false); // condicion NUEVO con placa HACK999 es inválido
    const ok = schema.safeParse({ ...currentAsRaw(current), disponibilidad: 'PROXIMAMENTE' });
    expect(ok.success).toBe(true);
    if (!ok.success) return;
    const data = editableData('none', ok.data)!;
    expect(Object.keys(data).sort()).toEqual(
      [
        'anio',
        'color',
        'combustible',
        'cilindraje',
        'condicion',
        'descripcion',
        'disponibilidad',
        'kilometraje',
        'modeloId',
        'placa',
        'precio',
        'transmision',
      ].sort()
    );
    expect(data.disponibilidad).toBe('PROXIMAMENTE');
  });
});

describe('canChangeVisibility', () => {
  it('reglas de ocultar y mostrar', () => {
    expect(canChangeVisibility('none', false)).toBe(true);
    expect(canChangeVisibility('none', true)).toBe(true);
    expect(canChangeVisibility('reserved', false)).toBe(false);
    expect(canChangeVisibility('reserved', true)).toBe(true);
    expect(canChangeVisibility('sold', false)).toBe(false);
    expect(canChangeVisibility('sold', true)).toBe(false);
  });
});
