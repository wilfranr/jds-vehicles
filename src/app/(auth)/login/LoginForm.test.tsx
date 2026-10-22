import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { siteContent } from '@/lib/site-content';

const loginAction = vi.fn();
vi.mock('./actions', () => ({ loginAction: (...args: unknown[]) => loginAction(...args) }));
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('next=%2Fvehiculos%2F3'),
}));

import { LoginForm } from './LoginForm';

describe('LoginForm', () => {
  it('renderiza campos con etiqueta, sin enlace de recuperación de contraseña', () => {
    render(<LoginForm />);
    expect(screen.getByLabelText('Correo electrónico')).toHaveAttribute('type', 'email');
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(screen.queryByText(/olvidaste/i)).not.toBeInTheDocument();
  });

  it('enlaza a /registro conservando next', () => {
    render(<LoginForm />);
    expect(screen.getByRole('link', { name: 'Crea una' })).toHaveAttribute(
      'href',
      '/registro?next=%2Fvehiculos%2F3'
    );
  });

  it('muestra el error genérico devuelto por la acción y conserva el correo', async () => {
    loginAction.mockResolvedValue({
      formError: siteContent.auth.invalidCredentials,
      values: { email: 'ana@example.com' },
    });
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText('Correo electrónico'), {
      target: { value: 'ana@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'x' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Iniciar sesión' }).closest('form')!);

    const alert = await screen.findByText('Correo o contraseña incorrectos.');
    expect(alert).toHaveAttribute('role', 'alert');
    await waitFor(() =>
      expect(screen.getByLabelText('Correo electrónico')).toHaveValue('ana@example.com')
    );
    expect(screen.getByLabelText('Contraseña')).toHaveValue('');
  });
});
