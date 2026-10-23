import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { listVehicles, getVehicleById, getFilterOptions, getSitemapVehicles } from './queries';
import { parseCatalogFilters } from './filters';
import { Disponibilidad, Condicion, Transmision, Combustible, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';

const TEST_COLOR_MARKER = '__test_marker_f107__';

describe('Capa de datos del catálogo (queries)', () => {
  let modeloIdParaPruebas: number;
  let testVehiculoVendidoId: number;
  let testVehiculoOcultoId: number;
  let testVehiculoReservadoId: number;
  let testVehiculoProximamenteId: number;

  beforeAll(async () => {
    // Verificar que la BD está disponible
    await prisma.$queryRawUnsafe('SELECT 1');

    // Obtener un modelo válido
    const modelo = await prisma.modelo.findFirst({
      where: { activo: true },
    });
    if (!modelo) {
      throw new Error('No se encontró ningún modelo en la BD para ejecutar las pruebas.');
    }
    modeloIdParaPruebas = modelo.id;

    // Crear 1 vehículo VENDIDO
    const vehiculoVendido = await prisma.vehiculo.create({
      data: {
        modeloId: modeloIdParaPruebas,
        anio: 2022,
        color: TEST_COLOR_MARKER,
        condicion: Condicion.USADO,
        placa: 'VEN999',
        precio: new Prisma.Decimal(120000000),
        kilometraje: 15000,
        transmision: Transmision.AUTOMATICA,
        combustible: Combustible.GASOLINA,
        disponibilidad: Disponibilidad.VENDIDO,
        visibleCatalogo: true,
      },
    });
    testVehiculoVendidoId = vehiculoVendido.id;

    // Crear 1 vehículo con visibleCatalogo = false (oculto)
    const vehiculoOculto = await prisma.vehiculo.create({
      data: {
        modeloId: modeloIdParaPruebas,
        anio: 2023,
        color: TEST_COLOR_MARKER,
        condicion: Condicion.NUEVO,
        precio: new Prisma.Decimal(180000000),
        kilometraje: 0,
        transmision: Transmision.AUTOMATICA,
        combustible: Combustible.HIBRIDO,
        disponibilidad: Disponibilidad.DISPONIBLE,
        visibleCatalogo: false,
      },
    });
    testVehiculoOcultoId = vehiculoOculto.id;

    // Crear 1 vehículo RESERVADO (este sí debe ser listado)
    const vehiculoReservado = await prisma.vehiculo.create({
      data: {
        modeloId: modeloIdParaPruebas,
        anio: 2021,
        color: TEST_COLOR_MARKER,
        condicion: Condicion.USADO,
        placa: 'RES777',
        precio: new Prisma.Decimal(95000000),
        kilometraje: 32000,
        transmision: Transmision.MANUAL,
        combustible: Combustible.GASOLINA,
        disponibilidad: Disponibilidad.RESERVADO,
        visibleCatalogo: true,
      },
    });
    testVehiculoReservadoId = vehiculoReservado.id;

    // Crear 1 vehículo PROXIMAMENTE (solo debe salir cuando se filtre explícitamente por PROXIMAMENTE)
    const vehiculoProximamente = await prisma.vehiculo.create({
      data: {
        modeloId: modeloIdParaPruebas,
        anio: 2025,
        color: TEST_COLOR_MARKER,
        condicion: Condicion.NUEVO,
        precio: new Prisma.Decimal(210000000),
        kilometraje: 0,
        transmision: Transmision.AUTOMATICA,
        combustible: Combustible.HIBRIDO,
        disponibilidad: Disponibilidad.PROXIMAMENTE,
        visibleCatalogo: true,
      },
    });
    testVehiculoProximamenteId = vehiculoProximamente.id;
  });

  afterAll(async () => {
    // Limpieza de datos de prueba
    await prisma.vehiculo.deleteMany({
      where: {
        id: {
          in: [
            testVehiculoVendidoId,
            testVehiculoOcultoId,
            testVehiculoReservadoId,
            testVehiculoProximamenteId,
          ].filter(Boolean),
        },
      },
    });
  });

  describe('listVehicles', () => {
    it('demuestra estrictamente que sin filtro solo lista DISPONIBLE y RESERVADO (PROXIMAMENTE, VENDIDO y ocultos quedan excluidos)', async () => {
      // Filtrar usando el color marcador único de prueba
      const result = await listVehicles(parseCatalogFilters({ color: TEST_COLOR_MARKER }));

      const ids = result.items.map((i) => i.id);
      expect(ids).not.toContain(testVehiculoVendidoId);
      expect(ids).not.toContain(testVehiculoOcultoId);
      expect(ids).not.toContain(testVehiculoProximamenteId);
      expect(ids).toContain(testVehiculoReservadoId);
    });

    it('incluye PROXIMAMENTE únicamente si se filtra explícitamente por disponibilidad=PROXIMAMENTE', async () => {
      const result = await listVehicles(
        parseCatalogFilters({
          color: TEST_COLOR_MARKER,
          disponibilidad: 'PROXIMAMENTE',
        })
      );

      const ids = result.items.map((i) => i.id);
      expect(ids).toContain(testVehiculoProximamenteId);
      expect(ids).not.toContain(testVehiculoReservadoId);
      expect(ids).not.toContain(testVehiculoVendidoId);
    });

    it('ignora intentos de forzar disponibilidad=VENDIDO desde los filtros y nunca muestra el vendido', async () => {
      const parsedFilters = parseCatalogFilters({
        color: TEST_COLOR_MARKER,
        disponibilidad: 'VENDIDO',
      });
      // El parser de filtros descarta 'VENDIDO' como disponibilidad válida del catálogo público
      expect(parsedFilters.disponibilidad).toBeUndefined();

      const result = await listVehicles(parsedFilters);
      const ids = result.items.map((i) => i.id);
      expect(ids).not.toContain(testVehiculoVendidoId);
      expect(ids).not.toContain(testVehiculoOcultoId);
      expect(ids).not.toContain(testVehiculoProximamenteId);
      expect(ids).toContain(testVehiculoReservadoId);
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
    it('retorna null para un vehículo con disponibilidad VENDIDO', async () => {
      const detail = await getVehicleById(testVehiculoVendidoId);
      expect(detail).toBeNull();
    });

    it('retorna null para un vehículo con visibleCatalogo = false', async () => {
      const detail = await getVehicleById(testVehiculoOcultoId);
      expect(detail).toBeNull();
    });

    it('retorna el detalle completo y enmascara la placa (nunca viaja completa en el JSON)', async () => {
      const detail = await getVehicleById(testVehiculoReservadoId);
      expect(detail).not.toBeNull();
      expect(detail?.id).toBe(testVehiculoReservadoId);
      expect(detail?.placaEnmascarada).toBe('***777');

      const jsonString = JSON.stringify(detail);
      // La placa real 'RES777' nunca debe existir en el JSON
      expect(jsonString).not.toContain('RES777');
      expect(jsonString).toContain('***777');

      // Comprobar serialización limpia
      const parsed = JSON.parse(jsonString);
      expect(parsed).toEqual(detail);
      expect(typeof detail?.createdAt).toBe('string');
      expect(typeof detail?.precio).toBe('number');
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

  describe('getFilterOptions: modelos solo próximamente', () => {
    const MODELO_SOLO_PROXIMAMENTE = '__test_modelo_proximamente_f106__';
    let modeloTemporalId: number;
    let vehiculoTemporalId: number;

    beforeAll(async () => {
      const base = await prisma.modelo.findUniqueOrThrow({ where: { id: modeloIdParaPruebas } });
      const modelo = await prisma.modelo.create({
        data: { marcaId: base.marcaId, nombre: MODELO_SOLO_PROXIMAMENTE },
      });
      modeloTemporalId = modelo.id;
      const vehiculo = await prisma.vehiculo.create({
        data: {
          modeloId: modelo.id,
          anio: 2025,
          color: TEST_COLOR_MARKER,
          condicion: Condicion.NUEVO,
          precio: new Prisma.Decimal(200000000),
          kilometraje: 0,
          transmision: Transmision.AUTOMATICA,
          combustible: Combustible.GASOLINA,
          disponibilidad: Disponibilidad.PROXIMAMENTE,
          visibleCatalogo: true,
        },
      });
      vehiculoTemporalId = vehiculo.id;
    });

    afterAll(async () => {
      await prisma.vehiculo.deleteMany({ where: { id: vehiculoTemporalId } });
      await prisma.modelo.deleteMany({ where: { id: modeloTemporalId } });
    });

    it('no ofrece modelos cuyos únicos vehículos son PROXIMAMENTE', async () => {
      const options = await getFilterOptions();
      const nombres = options.marcas.flatMap((m) => m.modelos.map((mo) => mo.nombre));
      expect(nombres).not.toContain(MODELO_SOLO_PROXIMAMENTE);
    });
  });

  describe('getSitemapVehicles', () => {
    it('lista vehículos visibles no vendidos y omite vendidos y ocultos', async () => {
      const ids = (await getSitemapVehicles()).map((v) => v.id);
      expect(ids).toContain(testVehiculoReservadoId);
      expect(ids).not.toContain(testVehiculoVendidoId);
      expect(ids).not.toContain(testVehiculoOcultoId);
    });
  });
});
