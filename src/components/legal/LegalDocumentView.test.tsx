import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { essentialCookies, type LegalDocument } from '@/lib/legal-content';
import { LegalDocumentView } from './LegalDocumentView';

const doc: LegalDocument = {
  title: 'Documento de prueba',
  effectiveDate: '2026-11-01',
  updatedAt: '2026-11-15',
  responsible: 'Responsable de prueba',
  sections: [
    { heading: 'Finalidades', paragraphs: ['Primer párrafo.'], items: ['Gestionar reservas'] },
    { heading: 'Derechos del titular', paragraphs: ['Segundo párrafo.'] },
  ],
};

describe('LegalDocumentView', () => {
  it('muestra título, vigencia, última actualización, responsable y secciones', () => {
    render(<LegalDocumentView kind="terminos" doc={doc} rightsEmail={null} />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Documento de prueba' })
    ).toBeInTheDocument();
    expect(screen.getByText('1 de noviembre de 2026')).toHaveAttribute('datetime', '2026-11-01');
    expect(screen.getByText('15 de noviembre de 2026')).toHaveAttribute('datetime', '2026-11-15');
    expect(screen.getByText('Responsable de prueba')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Finalidades' })).toBeInTheDocument();
    expect(screen.getByText('Gestionar reservas')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Derechos del titular' })
    ).toBeInTheDocument();
  });

  it('la política de privacidad lista todas las cookies; los términos no', () => {
    const { unmount } = render(
      <LegalDocumentView kind="privacidad" doc={doc} rightsEmail={null} />
    );
    const table = screen.getByRole('table');
    for (const cookie of essentialCookies) {
      expect(within(table).getByText(cookie.name)).toBeInTheDocument();
    }
    unmount();
    render(<LegalDocumentView kind="terminos" doc={doc} rightsEmail={null} />);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('el canal de derechos solo aparece en la política y si el propietario lo aportó', () => {
    const { unmount } = render(
      <LegalDocumentView kind="privacidad" doc={doc} rightsEmail="datos@ejemplo.test" />
    );
    expect(screen.getByRole('link', { name: 'datos@ejemplo.test' })).toHaveAttribute(
      'href',
      'mailto:datos@ejemplo.test'
    );
    unmount();
    render(<LegalDocumentView kind="privacidad" doc={doc} rightsEmail={null} />);
    expect(
      screen.queryByRole('heading', { name: 'Ejercicio de tus derechos' })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /@/ })).not.toBeInTheDocument();
  });
});
