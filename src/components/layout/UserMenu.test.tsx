import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { siteContent } from '@/lib/site-content';
import type { AuthUser } from '@/types/auth';

vi.mock('@/server/auth/logout-action', () => ({ logoutAction: vi.fn() }));

import { AccountControls } from './AccountControls';
import { MobileAccount } from './MobileAccount';
import { UserMenu } from './UserMenu';
import { displayFirstName, accountLinks } from './account-links';

const client: AuthUser = {
  id: 2,
  rol: 'CLIENTE',
  name: 'Carlos Alberto Gómez',
  email: 'c@example.com',
};
const admin: AuthUser = { id: 1, rol: 'ADMIN', name: 'Admin JDS', email: 'a@example.com' };

describe('AccountControls (sin sesión)', () => {
  it('muestra «Iniciar sesión» y «Crear cuenta»', () => {
    render(<AccountControls user={null} />);
    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: 'Crear cuenta' })).toHaveAttribute('href', '/registro');
  });
});

describe('UserMenu (con sesión)', () => {
  it('muestra el primer nombre y abre el menú con foco en el primer elemento', () => {
    render(<AccountControls user={client} />);
    const trigger = screen.getByRole('button', { name: /Carlos Alberto Gómez/ });
    expect(trigger).toHaveTextContent('Carlos');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Mi cuenta' })).toHaveAttribute(
      'href',
      '/mi-cuenta'
    );
    expect(screen.getByRole('menuitem', { name: 'Mis reservas' })).toHaveAttribute(
      'href',
      '/mi-cuenta/reservas'
    );
    expect(screen.getByRole('menuitem', { name: 'Cerrar sesión' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Mi cuenta' })).toHaveFocus();
  });

  it('se cierra con Escape y devuelve el foco al botón; las flechas recorren los elementos', () => {
    render(<UserMenu user={client} />);
    const trigger = screen.getByRole('button');
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: 'ArrowDown' });
    expect(screen.getByRole('menuitem', { name: 'Mis reservas' })).toHaveFocus();
    fireEvent.keyDown(document, { key: 'ArrowUp' });
    expect(screen.getByRole('menuitem', { name: 'Mi cuenta' })).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('cerrar sesión es un formulario (POST), no un enlace', () => {
    render(<UserMenu user={client} />);
    fireEvent.click(screen.getByRole('button'));
    const logout = screen.getByRole('menuitem', { name: 'Cerrar sesión' });
    expect(logout.tagName).toBe('BUTTON');
    expect(logout.closest('form')).not.toBeNull();
    expect(screen.queryByRole('link', { name: 'Cerrar sesión' })).not.toBeInTheDocument();
  });

  it('«Panel del concesionario» solo se ofrece a ADMIN y ASESOR', () => {
    expect(siteContent.account.showAdminPanelLink).toBe(true);
    expect(accountLinks('ADMIN').map((l) => l.href)).toContain('/admin');
    expect(accountLinks('ASESOR').map((l) => l.href)).toContain('/admin');
    expect(accountLinks('CLIENTE').map((l) => l.href)).not.toContain('/admin');
  });

  it('trunca nombres largos y tolera nombres vacíos', () => {
    expect(displayFirstName('Maximiliano-Alejandro-Gómez Pérez')).toHaveLength(14);
    expect(displayFirstName('   ')).toBe('Mi cuenta');
    expect(displayFirstName('Ana María')).toBe('Ana');
  });
});

describe('MobileAccount', () => {
  it('sin sesión ofrece iniciar sesión y crear cuenta', () => {
    render(<MobileAccount user={null} />);
    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: 'Crear cuenta' })).toBeInTheDocument();
  });

  it('con sesión muestra nombre, enlaces de cuenta y cerrar sesión por formulario', () => {
    render(<MobileAccount user={admin} />);
    expect(screen.getByText('Admin JDS')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mi cuenta' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cerrar sesión' }).closest('form')).not.toBeNull();
  });
});
