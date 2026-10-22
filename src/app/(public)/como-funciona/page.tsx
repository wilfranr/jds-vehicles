import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, ChevronDown, CheckCircle2 } from 'lucide-react';
import { siteContent } from '@/lib/site-content';

export const metadata: Metadata = {
  title: siteContent.comoFunciona.title,
  description: siteContent.comoFunciona.subtitle,
};

export default function ComoFuncionaPage() {
  const { heading, subtitle, steps, faqs, ctaTitle, ctaSubtitle, ctaButton } =
    siteContent.comoFunciona;

  return (
    <div className="px-gutter py-space-xl mx-auto w-full max-w-5xl">
      {/* Encabezado */}
      <div className="mb-12 text-center md:mb-16">
        <h1 className="font-headline-xl text-on-surface text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl">
          {heading}
        </h1>
        <p className="font-body-lg text-on-surface-variant mx-auto mt-3 max-w-2xl text-base sm:text-lg">
          {subtitle}
        </p>
      </div>

      {/* Pasos Numerados del Negocio */}
      <section aria-labelledby="pasos-heading" className="mb-16 md:mb-24">
        <h2 id="pasos-heading" className="sr-only">
          Pasos para comprar tu vehículo
        </h2>
        <div className="relative flex flex-col gap-6 sm:gap-8">
          {steps.map((step) => (
            <div
              key={step.number}
              className="bg-surface-container-lowest border-outline-variant/30 hover:border-secondary/30 relative flex flex-col items-start gap-4 rounded-2xl border p-6 shadow-sm transition-colors sm:flex-row sm:items-center sm:gap-6 sm:p-8"
            >
              {/* Indicador Numérico */}
              <div className="bg-surface-container text-secondary font-spec-numerical flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-xl font-black">
                {step.number}
              </div>

              {/* Contenido */}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-headline-sm text-on-surface text-lg font-bold sm:text-xl">
                    {step.title}
                  </h3>
                  <CheckCircle2 className="text-secondary/60 hidden h-4 w-4 sm:inline" />
                </div>
                <p className="font-body-md text-on-surface-variant mt-1 text-sm leading-relaxed sm:text-base">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Preguntas Frecuentes (Acordeón accesible con <details>) */}
      <section aria-labelledby="faqs-heading" className="mb-16 md:mb-20">
        <div className="mb-8 text-center sm:text-left">
          <h2
            id="faqs-heading"
            className="font-headline-lg text-on-surface text-2xl font-bold tracking-tight sm:text-3xl"
          >
            Preguntas Frecuentes
          </h2>
          <p className="font-body-md text-on-surface-variant mt-1 text-sm">
            Respuestas a las inquietudes más comunes sobre el proceso de reserva y compra.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {faqs.map((faq, index) => (
            <details
              key={index}
              className="bg-surface-container-lowest border-outline-variant/30 group open:ring-secondary/20 rounded-xl border p-5 shadow-sm transition-all open:ring-1"
            >
              <summary className="font-label-lg text-on-surface flex cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold focus-visible:outline-none">
                <span>{faq.question}</span>
                <ChevronDown className="text-on-surface-variant h-5 w-5 shrink-0 transition-transform duration-200 group-open:rotate-180" />
              </summary>
              <div className="border-outline-variant/20 font-body-md text-on-surface-variant mt-3 border-t pt-3 text-sm leading-relaxed">
                {faq.answer}
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* CTA hacia el Catálogo */}
      <section
        aria-labelledby="cta-heading"
        className="bg-surface-container-low border-outline-variant/30 flex flex-col items-center justify-between gap-6 rounded-2xl border p-8 text-center sm:p-12"
      >
        <div className="max-w-xl">
          <h2
            id="cta-heading"
            className="font-headline-lg text-on-surface text-2xl font-bold sm:text-3xl"
          >
            {ctaTitle}
          </h2>
          <p className="font-body-md text-on-surface-variant mt-2 text-sm sm:text-base">
            {ctaSubtitle}
          </p>
        </div>

        <Link
          href="/catalogo"
          className="font-label-lg bg-primary hover:bg-primary-hover focus-visible:outline-primary inline-flex items-center gap-2 rounded-xl px-6 py-3 text-base font-bold text-white shadow-md transition focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <span>{ctaButton}</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </div>
  );
}
