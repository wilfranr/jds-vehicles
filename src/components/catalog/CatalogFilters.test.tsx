import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { CatalogFilters } from './CatalogFilters';
import { type CatalogFilterOptions } from '@/types/catalog';
import { type NormalizedCatalogFilters } from '@/server/catalog/filters';
import { Condicion } from '@prisma/client';

const mockOptions: CatalogFilterOptions = {
  marcas: [
    {
      id: 1,
      nombre: 'BMW',
      modelos: [
        { id: 10, nombre: 'Serie 3', marcaId: 1 },
        { id: 11, nombre: 'X5', marcaId: 1 },
      ],
    },
    {
      id: 2,
      nombre: 'Mazda',
      modelos: [{ id: 20, nombre: 'CX-30', marcaId: 2 }],
    },
  ],
  colores: ['Blanco', 'Negro', 'Azul'],
  precioMin: 30000000,
  precioMax: 350000000,
  anioMin: 2018,
  anioMax: 2024,
};

const mockFiltersEmpty: NormalizedCatalogFilters = {
  orden: 'recientes',
  pagina: 1,
};

const mockFiltersActive: NormalizedCatalogFilters = {
  q: 'Mazda',
  condicion: Condicion.USADO,
  marca: 2,
  precioMin: 50000000,
  orden: 'precio_asc',
  pagina: 1,
};

describe('CatalogFilters', () => {
  it('renderiza correctamente las opciones de marca y controles', () => {
    render(<CatalogFilters options={mockOptions} currentFilters={mockFiltersEmpty} />);

    expect(screen.getByRole('heading', { name: /Filtros/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'BMW' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Mazda' })).toBeInTheDocument();
  });

  it('muestra chips activos y botón limpiar todo cuando hay filtros aplicados', () => {
    render(<CatalogFilters options={mockOptions} currentFilters={mockFiltersActive} />);

    expect(screen.getByText('Búsqueda: "Mazda"')).toBeInTheDocument();
    expect(screen.getByTitle('Quitar filtro Seminuevo')).toBeInTheDocument();
    expect(screen.getByText('Marca: Mazda')).toBeInTheDocument();
    expect(screen.getByText('Desde $50M')).toBeInTheDocument();
    expect(screen.getByText('Limpiar todo')).toBeInTheDocument();
  });
});
