import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SiteFooter } from './SiteFooter';

const base = { whatsappNumber: '573000000000', instagramUrl: 'https://instagram.com/ejemplo' };

describe('SiteFooter (enlaces legales)', () => {
  it('sin contenido legal no hay enlaces a /privacidad ni /terminos ni columna legal', () => {
    render(<SiteFooter {...base} />);
    expect(screen.queryByRole('link', { name: 'Política de privacidad' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Términos del servicio' })).not.toBeInTheDocument();
    expect(screen.queryByText('Legal')).not.toBeInTheDocument();
  });

  it('con contenido de prueba aparecen los enlaces', () => {
    render(
      <SiteFooter
        {...base}
        legalLinks={[
          { kind: 'privacidad', href: '/privacidad', label: 'Política de privacidad' },
          { kind: 'terminos', href: '/terminos', label: 'Términos del servicio' },
        ]}
      />
    );
    expect(screen.getByRole('link', { name: 'Política de privacidad' })).toHaveAttribute(
      'href',
      '/privacidad'
    );
    expect(screen.getByRole('link', { name: 'Términos del servicio' })).toHaveAttribute(
      'href',
      '/terminos'
    );
  });
});
