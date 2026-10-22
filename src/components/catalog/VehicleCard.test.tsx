import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { VehicleCard } from './VehicleCard';
import { type VehicleCardData } from '@/types/catalog';
import { Condicion, Disponibilidad, Transmision, Combustible } from '@prisma/client';

const mockVehicleNuevo: VehicleCardData = {
  id: 1,
  marcaId: 1,
  marcaNombre: 'BMW',
  modeloId: 10,
  modeloNombre: 'Serie 3 M340i',
  anio: 2024,
  condicion: Condicion.NUEVO,
  precio: 250000000,
  kilometraje: 0,
  transmision: Transmision.AUTOMATICA,
  combustible: Combustible.GASOLINA,
  cilindraje: 3000,
  color: 'Azul Portimao',
  disponibilidad: Disponibilidad.DISPONIBLE,
  fotoPrincipalUrl: 'https://images.unsplash.com/photo-1555215695-3004980ad54e',
  totalFotos: 8,
};

const mockVehicleUsado: VehicleCardData = {
  ...mockVehicleNuevo,
  id: 2,
  condicion: Condicion.USADO,
  kilometraje: 28500,
  disponibilidad: Disponibilidad.DISPONIBLE,
};

const mockVehicleReservado: VehicleCardData = {
  ...mockVehicleNuevo,
  id: 3,
  disponibilidad: Disponibilidad.RESERVADO,
};

const mockVehicleSinFoto: VehicleCardData = {
  ...mockVehicleNuevo,
  id: 4,
  fotoPrincipalUrl: null,
  totalFotos: 0,
};

describe('VehicleCard', () => {
  it('renderiza correctamente un vehículo nuevo con su badge y kilometraje 0 km', () => {
    render(<VehicleCard vehicle={mockVehicleNuevo} />);

    expect(screen.getByText('BMW Serie 3 M340i')).toBeInTheDocument();
    expect(screen.getByText('NUEVO')).toBeInTheDocument();
    expect(screen.getByText('0 km (Nuevo)')).toBeInTheDocument();
    expect(screen.getByText('$ 250.000.000')).toBeInTheDocument();
  });

  it('renderiza correctamente un vehículo usado con su kilometraje formateado y badge SEMINUEVO', () => {
    render(<VehicleCard vehicle={mockVehicleUsado} />);

    expect(screen.getByText('SEMINUEVO')).toBeInTheDocument();
    expect(screen.getByText('28.500 km')).toBeInTheDocument();
  });

  it('renderiza el badge RESERVADO cuando la disponibilidad es RESERVADO', () => {
    render(<VehicleCard vehicle={mockVehicleReservado} />);

    expect(screen.getByText(/RESERVADO/i)).toBeInTheDocument();
  });

  it('muestra marcador de posición cuando no hay foto disponible', () => {
    render(<VehicleCard vehicle={mockVehicleSinFoto} />);

    expect(screen.getByText('Foto no disponible')).toBeInTheDocument();
  });
});
