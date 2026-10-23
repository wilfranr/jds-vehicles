import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { LegalContent } from '@/lib/legal-content';

// `notFound()` lanza; en la prueba lo reconocemos por su mensaje.
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

const content = vi.hoisted(() => ({ privacidad: null, terminos: null }) as LegalContent);
vi.mock('@/lib/legal-content', async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>();
  return { ...original, legalContent: content };
});

import PrivacidadPage, { generateMetadata as privacidadMetadata } from './privacidad/page';
import TerminosPage, { generateMetadata as terminosMetadata } from './terminos/page';

const doc = (title: string) => ({
  title,
  effectiveDate: '2026-11-01',
  updatedAt: '2026-11-15',
  responsible: 'Responsable de prueba',
  sections: [{ heading: 'Sección', paragraphs: ['Contenido de prueba.'] }],
});

beforeEach(() => {
  content.privacidad = null;
  content.terminos = null;
});

describe('/privacidad y /terminos', () => {
  it('sin contenido responden 404 y no definen metadatos', () => {
    expect(() => PrivacidadPage()).toThrow('NEXT_NOT_FOUND');
    expect(() => TerminosPage()).toThrow('NEXT_NOT_FOUND');
    expect(privacidadMetadata()).toEqual({});
    expect(terminosMetadata()).toEqual({});
  });

  it('con un documento marcado TODO(owner) siguen en 404', () => {
    content.privacidad = doc('TODO(owner): política');
    expect(() => PrivacidadPage()).toThrow('NEXT_NOT_FOUND');
  });

  it('con contenido de prueba aparecen, con título, canonical e indexación normal', () => {
    content.privacidad = doc('Política de prueba');
    content.terminos = doc('Términos de prueba');
    render(<PrivacidadPage />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Política de prueba' })
    ).toBeInTheDocument();

    const meta = privacidadMetadata();
    expect(meta.title).toBe('Política de prueba');
    expect(meta.alternates?.canonical).toBe('/privacidad');
    expect(meta.robots).toBeUndefined(); // indexable
    expect(terminosMetadata().alternates?.canonical).toBe('/terminos');
    expect(() => TerminosPage()).not.toThrow();
  });
});
