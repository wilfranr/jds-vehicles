import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { VehicleGallery } from './VehicleGallery';
import { ReserveCta } from './ReserveCta';
import { Disponibilidad } from '@prisma/client';

describe('VehicleGallery', () => {
  const mockPhotos = [
    { id: 1, url: 'https://images.unsplash.com/photo-1', esPrincipal: true, ordenPresentacion: 1 },
    { id: 2, url: 'https://images.unsplash.com/photo-2', esPrincipal: false, ordenPresentacion: 2 },
  ];

  it('muestra el contador inicial 1 / 2 y permite avanzar con las flechas', () => {
    render(<VehicleGallery photos={mockPhotos} title="Toyota Corolla" />);

    expect(screen.getByText('1 / 2')).toBeInTheDocument();

    const nextBtn = screen.getByLabelText('Ver siguiente foto');
    fireEvent.click(nextBtn);

    expect(screen.getByText('2 / 2')).toBeInTheDocument();
  });

  it('muestra estado neutral cuando no hay fotos', () => {
    render(<VehicleGallery photos={[]} title="Toyota Corolla" />);
    expect(screen.getByText(/Fotografías del vehículo en preparación/i)).toBeInTheDocument();
  });

  it('abre y cierra el diálogo de pantalla completa', () => {
    render(<VehicleGallery photos={mockPhotos} title="Toyota Corolla" />);

    const openModalBtn = screen.getByLabelText('Ver fotografía en pantalla completa');
    fireEvent.click(openModalBtn);

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    const closeModalBtn = screen.getByLabelText('Cerrar vista de pantalla completa');
    fireEvent.click(closeModalBtn);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('ReserveCta', () => {
  it('renderiza CTA de preventa cuando disponibilidad es PROXIMAMENTE', () => {
    render(
      <ReserveCta
        vehicleId={1}
        marca="Toyota"
        modelo="Hilux"
        anio={2024}
        disponibilidad={Disponibilidad.PROXIMAMENTE}
        whatsappNumber="573202353168"
      />
    );

    expect(screen.getByText(/Vehículo en preparación \(Preventa\)/i)).toBeInTheDocument();
    expect(screen.getByText('Preguntar por este vehículo')).toBeInTheDocument();
  });

  it('renderiza mensaje de reserva cuando disponibilidad es RESERVADO', () => {
    render(
      <ReserveCta
        vehicleId={2}
        marca="Mazda"
        modelo="CX-30"
        anio={2022}
        disponibilidad={Disponibilidad.RESERVADO}
        whatsappNumber="573202353168"
      />
    );

    expect(screen.getByText(/Este vehículo se encuentra reservado/i)).toBeInTheDocument();
    expect(screen.getByText('Consultar alternativas por WhatsApp')).toBeInTheDocument();
  });

  it('renderiza botón principal de reserva cuando disponibilidad es DISPONIBLE', () => {
    render(
      <ReserveCta
        vehicleId={3}
        marca="BMW"
        modelo="M3"
        anio={2023}
        disponibilidad={Disponibilidad.DISPONIBLE}
        whatsappNumber="573202353168"
      />
    );

    expect(screen.getByText('Consultar reserva por WhatsApp')).toBeInTheDocument();
    expect(screen.getByText('Escribir por WhatsApp')).toBeInTheDocument();
  });
});
