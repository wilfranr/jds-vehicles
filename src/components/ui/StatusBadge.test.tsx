import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { StatusBadge } from './StatusBadge';

describe('StatusBadge', () => {
  it("muestra la etiqueta 'NUEVO' para el estado NUEVO", () => {
    render(<StatusBadge status="NUEVO" />);
    expect(screen.getByText('NUEVO')).toBeInTheDocument();
  });

  it("muestra la etiqueta 'SEMINUEVO' para el estado USADO", () => {
    render(<StatusBadge status="USADO" />);
    expect(screen.getByText('SEMINUEVO')).toBeInTheDocument();
  });

  it('renderiza badges de RESERVADO, VENDIDO y PROXIMAMENTE', () => {
    const { rerender } = render(<StatusBadge status="RESERVADO" />);
    expect(screen.getByText('RESERVADO')).toBeInTheDocument();

    rerender(<StatusBadge status="VENDIDO" />);
    expect(screen.getByText('VENDIDO')).toBeInTheDocument();

    rerender(<StatusBadge status="PROXIMAMENTE" />);
    expect(screen.getByText('PRÓXIMAMENTE')).toBeInTheDocument();
  });
});
