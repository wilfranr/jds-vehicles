import {
  legalContent,
  type LegalContent,
  type LegalDocument,
  type LegalKind,
} from '@/lib/legal-content';
import { siteContent } from '@/lib/site-content';

const PENDING_MARKER = 'TODO(owner)';
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const LEGAL_KINDS: readonly LegalKind[] = ['privacidad', 'terminos'];

const filled = (value: unknown): value is string =>
  typeof value === 'string' && value.trim() !== '';

function isIsoDate(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    ISO_DATE.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().startsWith(value)
  );
}

/** Un documento solo se publica si está completo y no conserva el marcador de pendiente del propietario. */
export function isPublishable(doc: LegalDocument | null | undefined): doc is LegalDocument {
  if (!doc) return false;
  if (!filled(doc.title) || !filled(doc.responsible)) return false;
  if (!isIsoDate(doc.effectiveDate) || !isIsoDate(doc.updatedAt)) return false;
  if (!Array.isArray(doc.sections) || doc.sections.length === 0) return false;
  const sectionsOk = doc.sections.every(
    (s) =>
      filled(s.heading) &&
      s.paragraphs.length > 0 &&
      s.paragraphs.every(filled) &&
      (s.items ?? []).every(filled)
  );
  return sectionsOk && !JSON.stringify(doc).includes(PENDING_MARKER);
}

/** Documento publicable o `null` (la página responde 404). El contenido se inyecta solo en las pruebas. */
export function getLegalDocument(
  kind: LegalKind,
  content: LegalContent = legalContent
): LegalDocument | null {
  const doc = content[kind];
  return isPublishable(doc) ? doc : null;
}

export interface LegalLink {
  kind: LegalKind;
  href: string;
  label: string;
}

/** Enlaces a las páginas legales que existen. Vacío mientras el propietario no aporte el contenido. */
export function getLegalLinks(content: LegalContent = legalContent): LegalLink[] {
  return LEGAL_KINDS.filter((kind) => getLegalDocument(kind, content) !== null).map((kind) => ({
    kind,
    href: siteContent.legal.pages[kind].href,
    label: siteContent.legal.pages[kind].linkLabel,
  }));
}

/** Canal para ejercer derechos: solo si el propietario lo aportó y es un correo plausible. */
export function getRightsEmail(email: string = siteContent.legal.rightsEmail): string | null {
  const value = email.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value : null;
}

/** «23 de octubre de 2026» a partir de AAAA-MM-DD, sin depender de la zona horaria del servidor. */
export function formatLegalDate(isoDate: string): string {
  return new Intl.DateTimeFormat('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${isoDate}T00:00:00Z`));
}
