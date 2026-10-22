import { describe, it, expect } from 'vitest';
import { parseCatalogFilters } from './filters';
import { Condicion, Transmision, Combustible, Disponibilidad } from '@prisma/client';

describe('parseCatalogFilters', () => {
  it('retorna valores por defecto ante un input vacío o undefined', () => {
    const filters = parseCatalogFilters(undefined);
    expect(filters.pagina).toBe(1);
    expect(filters.orden).toBe('recientes');
    expect(filters.q).toBeUndefined();
    expect(filters.marca).toBeUndefined();
  });

  it('intercambia precioMin y precioMax si min > max', () => {
    const filters = parseCatalogFilters({
      precioMin: '100000000',
      precioMax: '50000000',
    });
    expect(filters.precioMin).toBe(50000000);
    expect(filters.precioMax).toBe(100000000);
  });

  it('intercambia anioMin y anioMax si min > max', () => {
    const filters = parseCatalogFilters({
      anioMin: '2024',
      anioMax: '2019',
    });
    expect(filters.anioMin).toBe(2019);
    expect(filters.anioMax).toBe(2024);
  });

  it('corrige páginas menores a 1 o números negativos', () => {
    expect(parseCatalogFilters({ pagina: '-3' }).pagina).toBe(1);
    expect(parseCatalogFilters({ pagina: '0' }).pagina).toBe(1);
    expect(parseCatalogFilters({ pagina: 'abc' }).pagina).toBe(1);
    expect(parseCatalogFilters({ pagina: '5' }).pagina).toBe(5);
  });

  it('descarta orden inválido y usa "recientes"', () => {
    expect(parseCatalogFilters({ orden: 'zzz' }).orden).toBe('recientes');
    expect(parseCatalogFilters({ orden: 'precio_desc' }).orden).toBe('precio_desc');
  });

  it('limita longitud de q a 80 caracteres', () => {
    const longQuery = 'a'.repeat(120);
    const parsed = parseCatalogFilters({ q: longQuery });
    expect(parsed.q?.length).toBe(80);
  });

  it('normaliza condicion, transmision, combustible y disponibilidad en mayúsculas', () => {
    const parsed = parseCatalogFilters({
      condicion: 'usado',
      transmision: 'automatica',
      combustible: 'gasolina',
      disponibilidad: 'disponible',
    });
    expect(parsed.condicion).toBe(Condicion.USADO);
    expect(parsed.transmision).toBe(Transmision.AUTOMATICA);
    expect(parsed.combustible).toBe(Combustible.GASOLINA);
    expect(parsed.disponibilidad).toBe(Disponibilidad.DISPONIBLE);
  });

  it('resiste fuzzing y strings malformadas sin lanzar error', () => {
    const garbageInputs = [
      { q: undefined, marca: 'NaN', modelo: '-12', precioMin: 'null' },
      { condicion: 'DESCONOCIDO', orden: 'DROP TABLE', pagina: '99999999999999999999999' },
      { color: '   ', anioMin: 'undefined', transmision: '123' },
    ];

    for (const input of garbageInputs) {
      expect(() => parseCatalogFilters(input)).not.toThrow();
      const res = parseCatalogFilters(input);
      expect(res.pagina).toBeGreaterThanOrEqual(1);
      expect(typeof res.orden).toBe('string');
    }
  });

  it('parsea correctamente instancias de URLSearchParams', () => {
    const params = new URLSearchParams();
    params.set('q', 'BMW M3');
    params.set('precioMin', '30000000');
    params.set('orden', 'precio_asc');
    params.set('pagina', '2');

    const parsed = parseCatalogFilters(params);
    expect(parsed.q).toBe('BMW M3');
    expect(parsed.precioMin).toBe(30000000);
    expect(parsed.orden).toBe('precio_asc');
    expect(parsed.pagina).toBe(2);
  });
});
