import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LegalDocumentView } from '@/components/legal/LegalDocumentView';
import { getLegalDocument, getRightsEmail } from '@/lib/legal';
import { siteContent } from '@/lib/site-content';

const KIND = 'terminos';

// Sin contenido legal publicable no hay página: responde 404 (ver `src/lib/legal.ts`).
export function generateMetadata(): Metadata {
  const doc = getLegalDocument(KIND);
  if (!doc) return {};
  return {
    title: doc.title,
    description: siteContent.legal.pages[KIND].description,
    alternates: { canonical: siteContent.legal.pages[KIND].href },
  };
}

export default function TerminosPage() {
  const doc = getLegalDocument(KIND);
  if (!doc) notFound();
  return <LegalDocumentView kind={KIND} doc={doc} rightsEmail={getRightsEmail()} />;
}
