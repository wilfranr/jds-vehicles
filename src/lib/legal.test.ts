import { describe, expect, it } from 'vitest';
import { legalContent, type LegalContent, type LegalDocument } from '@/lib/legal-content';
import {
  formatLegalDate,
  getLegalDocument,
  getLegalLinks,
  getRightsEmail,
  isPublishable,
} from '@/lib/legal';
import { siteContent } from '@/lib/site-content';

const valid: LegalDocument = {
  title: 'Política de tratamiento de datos personales',
  effectiveDate: '2026-11-01',
  updatedAt: '2026-11-15',
  responsible: 'Responsable de prueba S.A.S. (NIT de prueba)',
  sections: [
    { heading: 'Finalidades', paragraphs: ['Texto de prueba.'], items: ['Gestionar reservas'] },
  ],
};
const only = (privacidad: LegalDocument | null, terminos: LegalDocument | null = null) =>
  ({ privacidad, terminos }) as LegalContent;

describe('contenido legal entregado', () => {
  it('mientras el propietario no lo aporte no hay documentos ni enlaces', () => {
    expect(legalContent.privacidad).toBeNull();
    expect(legalContent.terminos).toBeNull();
    expect(getLegalDocument('privacidad')).toBeNull();
    expect(getLegalDocument('terminos')).toBeNull();
    expect(getLegalLinks()).toEqual([]);
  });

  it('el canal de derechos está vacío hasta que el propietario lo aporte', () => {
    expect(siteContent.legal.rightsEmail).toBe('');
    expect(getRightsEmail()).toBeNull();
  });
});

describe('isPublishable', () => {
  it('acepta un documento completo', () => {
    expect(isPublishable(valid)).toBe(true);
  });

  it('rechaza nulo, vacío o incompleto', () => {
    expect(isPublishable(null)).toBe(false);
    expect(isPublishable(undefined)).toBe(false);
    expect(isPublishable({ ...valid, title: '  ' })).toBe(false);
    expect(isPublishable({ ...valid, responsible: '' })).toBe(false);
    expect(isPublishable({ ...valid, sections: [] })).toBe(false);
    expect(isPublishable({ ...valid, sections: [{ heading: 'A', paragraphs: [] }] })).toBe(false);
    expect(isPublishable({ ...valid, sections: [{ heading: '', paragraphs: ['x'] }] })).toBe(false);
    expect(isPublishable({ ...valid, sections: [{ heading: 'A', paragraphs: [' '] }] })).toBe(
      false
    );
  });

  it('rechaza fechas inválidas', () => {
    expect(isPublishable({ ...valid, effectiveDate: '01/11/2026' })).toBe(false);
    expect(isPublishable({ ...valid, effectiveDate: '2026-02-31' })).toBe(false);
    expect(isPublishable({ ...valid, updatedAt: '' })).toBe(false);
  });

  it('rechaza cualquier campo que conserve el marcador TODO(owner)', () => {
    expect(isPublishable({ ...valid, title: 'TODO(owner): título' })).toBe(false);
    expect(isPublishable({ ...valid, responsible: 'TODO(owner)' })).toBe(false);
    expect(
      isPublishable({
        ...valid,
        sections: [{ heading: 'A', paragraphs: ['ok'], items: ['TODO(owner): completar'] }],
      })
    ).toBe(false);
  });
});

describe('getLegalDocument y getLegalLinks', () => {
  it('con contenido de prueba la página existe y se enlaza; sin él, no', () => {
    const content = only(valid);
    expect(getLegalDocument('privacidad', content)).toBe(valid);
    expect(getLegalDocument('terminos', content)).toBeNull();
    expect(getLegalLinks(content)).toEqual([
      { kind: 'privacidad', href: '/privacidad', label: 'Política de privacidad' },
    ]);
  });

  it('enlaza ambas páginas cuando existen las dos, en orden estable', () => {
    expect(getLegalLinks(only(valid, valid)).map((l) => l.href)).toEqual([
      '/privacidad',
      '/terminos',
    ]);
  });

  it('un documento con pendientes no se enlaza', () => {
    expect(getLegalLinks(only({ ...valid, title: 'TODO(owner)' }))).toEqual([]);
  });
});

describe('getRightsEmail', () => {
  it('solo devuelve un correo plausible', () => {
    expect(getRightsEmail(' datos@ejemplo.test ')).toBe('datos@ejemplo.test');
    expect(getRightsEmail('')).toBeNull();
    expect(getRightsEmail('no-es-correo')).toBeNull();
  });
});

describe('formatLegalDate', () => {
  it('da la fecha en español sin desfase de zona horaria', () => {
    expect(formatLegalDate('2026-11-01')).toBe('1 de noviembre de 2026');
    expect(formatLegalDate('2026-01-31')).toBe('31 de enero de 2026');
  });
});
