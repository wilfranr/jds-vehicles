import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('./actions', () => ({ registerAction: vi.fn() }));

import { RegisterForm } from './RegisterForm';

describe('RegisterForm (consentimiento y enlaces legales)', () => {
  it('sin contenido legal solo muestra la casilla, sin enlaces', () => {
    render(<RegisterForm />);
    expect(
      screen.getByLabelText('Autorizo el tratamiento de mis datos personales.')
    ).toBeRequired();
    expect(screen.queryByRole('link', { name: 'Política de privacidad' })).not.toBeInTheDocument();
    expect(screen.queryByText('Consulta:')).not.toBeInTheDocument();
  });

  it('con contenido de prueba enlaza la política y los términos junto a la casilla', () => {
    render(
      <RegisterForm
        legalLinks={[
          { kind: 'privacidad', href: '/privacidad', label: 'Política de privacidad' },
          { kind: 'terminos', href: '/terminos', label: 'Términos del servicio' },
        ]}
      />
    );
    expect(screen.getByText(/Consulta:/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Política de privacidad' })).toHaveAttribute(
      'href',
      '/privacidad'
    );
    expect(screen.getByRole('link', { name: 'Términos del servicio' })).toHaveAttribute(
      'href',
      '/terminos'
    );
    // La casilla sigue siendo obligatoria y su etiqueta no incluye los enlaces.
    expect(
      screen.getByLabelText('Autorizo el tratamiento de mis datos personales.')
    ).toBeRequired();
  });
});
