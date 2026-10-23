import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { EstadoReserva } from '@prisma/client';
import { siteContent } from '@/lib/site-content';
import type { ReservationSummary } from '@/server/reservations/queries';
import { ReservationCard } from './ReservationCard';
import { ReservationStatusChip } from './ReservationStatusChip';

const base: ReservationSummary = {
  id: 1,
  codigo: 'RES-2026-AB2C',
  estado: 'PENDIENTE_CONTACTO',
  fechaReserva: new Date('2026-10-23T15:00:00Z'),
  fechaExpiracion: null,
  vehiculo: {
    id: 9,
    marca: 'Toyota',
    modelo: 'Corolla',
    anio: 2024,
    color: 'Blanco',
    fotoUrl: null,
  },
};

describe('ReservationStatusChip', () => {
  it.each(Object.entries(siteContent.cuenta.reservations.statusLabels))(
    'muestra el estado %s como texto',
    (estado, label) => {
      render(<ReservationStatusChip estado={estado as EstadoReserva} />);
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  );
});

describe('ReservationCard', () => {
  it('muestra vehículo, código, fecha, estado y el enlace al detalle', () => {
    render(<ReservationCard reservation={base} />);

    expect(screen.getByRole('heading', { name: 'Toyota Corolla 2024' })).toBeInTheDocument();
    expect(screen.getByText('RES-2026-AB2C')).toBeInTheDocument();
    expect(screen.getByText('Pendiente de contacto')).toBeInTheDocument();
    expect(screen.getByText('Foto no disponible')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ver detalle/ })).toHaveAttribute(
      'href',
      '/mi-cuenta/reservas/RES-2026-AB2C'
    );
  });

  it('sin fecha de expiración no menciona plazos', () => {
    render(<ReservationCard reservation={base} />);
    expect(screen.queryByText(/Vigente hasta/)).not.toBeInTheDocument();
  });

  it('con fecha de expiración la muestra', () => {
    render(
      <ReservationCard
        reservation={{ ...base, fechaExpiracion: new Date('2026-10-25T15:00:00Z') }}
      />
    );
    expect(screen.getByText(/Vigente hasta/)).toBeInTheDocument();
  });
});
