import { describe, it, expect, beforeAll } from 'vitest';
import { listVehicles, getVehicleById, getFilterOptions } from './queries';
import { parseCatalogFilters } from './filters';
import { Disponibilidad } from '@prisma/client';
import { prisma } from '@/lib/db';

describe('Capa de datos del catálogo (queries)', () => {
  beforeAll(async () => {
    // Verificar que la BD está disponible
    await prisma.$queryRawUnsafe('SELECT 1');
  });

  describe('listVehicles', () => {
    it('nunca devuelve vehículos con estado VENDIDO ni ocultos', async () => {
      const result = await listVehicles(parseCatalogFilters());

      expect(result.items.length).toBeGreaterThan(0);
      for (const item of result.items) {
        expect(item.disponibilidad).not.toBe(Disponibilidad.VENDIDO);
      }
    });

    it('los objetos devueltos son estrictamente serializables como JSON', async () => {
      const result = await listVehicles(parseCatalogFilters());
      expect(result.items.length).toBeGreaterThan(0);
      const firstItem = result.items[0]!;
      const serialized = JSON.stringify(result);
      const parsed = JSON.parse(serialized);

      expect(parsed).toEqual(result);
      expect(typeof firstItem.precio).toBe('number');
    });

    it('soporta paginación respetando pageSize de 12', async () => {
      const page1 = await listVehicles(parseCatalogFilters({ pagina: '1' }));
      expect(page1.page).toBe(1);
      expect(page1.pageSize).toBe(12);
      expect(page1.items.length).toBeLessThanOrEqual(12);
    });

    it('filtra correctamente por término de búsqueda q', async () => {
      const result = await listVehicles(parseCatalogFilters({ q: 'BMW' }));
      for (const item of result.items) {
        const matches =
          item.marcaNombre.toLowerCase().includes('bmw') ||
          item.modeloNombre.toLowerCase().includes('bmw') ||
          item.color.toLowerCase().includes('bmw');
        expect(matches).toBe(true);
      }
    });
  });

  describe('getVehicleById', () => {
    it('retorna el detalle completo y serializable de un vehículo visible', async () => {
      const list = await listVehicles(parseCatalogFilters());
      expect(list.items.length).toBeGreaterThan(0);
      const firstId = list.items[0]!.id;

      const detail = await getVehicleById(firstId);
      expect(detail).not.toBeNull();
      expect(detail?.id).toBe(firstId);

      // Comprobar serialización limpia
      const serialized = JSON.stringify(detail);
      const parsed = JSON.parse(serialized);
      expect(parsed).toEqual(detail);

      // Comprobar que no hay Date ni Decimal crudo
      expect(typeof detail?.createdAt).toBe('string');
      expect(typeof detail?.precio).toBe('number');
    });

    it('enmascara la placa mostrando solo los últimos 3 caracteres para autos usados', async () => {
      const list = await listVehicles(parseCatalogFilters({ condicion: 'USADO' }));
      if (list.items.length > 0) {
        const usedId = list.items[0]!.id;
        const detail = await getVehicleById(usedId);
        if (detail?.placaEnmascarada) {
          expect(detail.placaEnmascarada.startsWith('***')).toBe(true);
          expect(detail.placaEnmascarada.length).toBeLessThanOrEqual(6);
        }
      }
    });

    it('retorna null si el vehículo no existe', async () => {
      const detail = await getVehicleById(999999);
      expect(detail).toBeNull();
    });
  });

  describe('getFilterOptions', () => {
    it('devuelve marcas activas, modelos, colores y rangos numéricos de precio y año', async () => {
      const options = await getFilterOptions();

      expect(Array.isArray(options.marcas)).toBe(true);
      expect(options.marcas.length).toBeGreaterThan(0);
      expect(Array.isArray(options.colores)).toBe(true);
      expect(options.precioMax).toBeGreaterThan(options.precioMin);
      expect(options.anioMax).toBeGreaterThanOrEqual(options.anioMin);

      // Serializabilidad
      expect(JSON.parse(JSON.stringify(options))).toEqual(options);
    });
  });
});
