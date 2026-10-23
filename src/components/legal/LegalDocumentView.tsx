import React from 'react';
import { essentialCookies, type LegalDocument, type LegalKind } from '@/lib/legal-content';
import { formatLegalDate } from '@/lib/legal';
import { siteContent } from '@/lib/site-content';

interface LegalDocumentViewProps {
  kind: LegalKind;
  doc: LegalDocument;
  /** Canal para ejercer derechos (solo si el propietario lo aportó). */
  rightsEmail: string | null;
}

/** Documento legal con fecha de vigencia y de última actualización visibles. En la política, lista de cookies. */
export function LegalDocumentView({ kind, doc, rightsEmail }: LegalDocumentViewProps) {
  const copy = siteContent.legal;
  return (
    <article className="px-gutter py-space-xl mx-auto w-full max-w-3xl">
      <header className="mb-8">
        <h1 className="font-headline-xl text-on-surface text-3xl font-extrabold tracking-tight sm:text-4xl">
          {doc.title}
        </h1>
        <dl className="text-on-surface-variant mt-4 grid gap-1 text-sm">
          <div className="flex flex-wrap gap-x-2">
            <dt className="font-semibold">{copy.effectiveLabel}:</dt>
            <dd>
              <time dateTime={doc.effectiveDate}>{formatLegalDate(doc.effectiveDate)}</time>
            </dd>
          </div>
          <div className="flex flex-wrap gap-x-2">
            <dt className="font-semibold">{copy.updatedLabel}:</dt>
            <dd>
              <time dateTime={doc.updatedAt}>{formatLegalDate(doc.updatedAt)}</time>
            </dd>
          </div>
          <div className="flex flex-wrap gap-x-2">
            <dt className="font-semibold">{copy.responsibleLabel}:</dt>
            <dd>{doc.responsible}</dd>
          </div>
        </dl>
      </header>

      <div className="flex flex-col gap-8">
        {doc.sections.map((section) => (
          <section key={section.heading} aria-labelledby={`legal-${slug(section.heading)}`}>
            <h2
              id={`legal-${slug(section.heading)}`}
              className="font-headline-sm text-on-surface mb-3 text-xl font-bold"
            >
              {section.heading}
            </h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph} className="text-on-surface mb-3 leading-relaxed">
                {paragraph}
              </p>
            ))}
            {section.items && (
              <ul className="text-on-surface list-disc space-y-1 pl-6">
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </section>
        ))}

        {kind === 'privacidad' && rightsEmail && (
          <section aria-labelledby="legal-derechos">
            <h2
              id="legal-derechos"
              className="font-headline-sm text-on-surface mb-3 text-xl font-bold"
            >
              {copy.rightsHeading}
            </h2>
            <p className="text-on-surface leading-relaxed">
              {copy.rightsIntro}{' '}
              <a
                href={`mailto:${rightsEmail}`}
                className="text-secondary focus-visible:ring-primary rounded underline focus-visible:ring-2 focus-visible:outline-none"
              >
                {rightsEmail}
              </a>
              .
            </p>
          </section>
        )}

        {kind === 'privacidad' && (
          <section aria-labelledby="legal-cookies">
            <h2
              id="legal-cookies"
              className="font-headline-sm text-on-surface mb-3 text-xl font-bold"
            >
              {copy.cookiesHeading}
            </h2>
            <p className="text-on-surface mb-3 leading-relaxed">{copy.cookiesIntro}</p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-outline-variant/40 border-b">
                    <th scope="col" className="py-2 pr-4 font-semibold">
                      {copy.cookiesColumns.name}
                    </th>
                    <th scope="col" className="py-2 pr-4 font-semibold">
                      {copy.cookiesColumns.purpose}
                    </th>
                    <th scope="col" className="py-2 font-semibold">
                      {copy.cookiesColumns.duration}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {essentialCookies.map((cookie) => (
                    <tr key={cookie.name} className="border-outline-variant/20 border-b">
                      <td className="py-2 pr-4 font-mono">{cookie.name}</td>
                      <td className="py-2 pr-4">{cookie.purpose}</td>
                      <td className="py-2">{cookie.duration}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </article>
  );
}

function slug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
