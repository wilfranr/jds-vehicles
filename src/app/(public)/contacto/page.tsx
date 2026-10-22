import React from 'react';
import type { Metadata } from 'next';
import { MessageCircle, ExternalLink } from 'lucide-react';
import { getDealerConfig } from '@/server/config';
import { siteContent } from '@/lib/site-content';
import { buildWhatsAppUrl } from '@/lib/whatsapp';

export const metadata: Metadata = {
  title: siteContent.contacto.title,
  description: siteContent.contacto.subtitle,
};

export default async function ContactoPage() {
  const dealerConfig = await getDealerConfig();
  const {
    heading,
    subtitle,
    whatsappTitle,
    whatsappDescription,
    whatsappButtonText,
    instagramTitle,
    instagramDescription,
    instagramButtonText,
  } = siteContent.contacto;

  const whatsappUrl = buildWhatsAppUrl(
    dealerConfig.whatsappNumber,
    siteContent.defaultWhatsAppMessage
  );

  return (
    <div className="px-gutter py-space-xl mx-auto w-full max-w-4xl">
      {/* Encabezado */}
      <div className="mb-12 text-center">
        <h1 className="font-headline-xl text-on-surface text-3xl font-extrabold tracking-tight sm:text-4xl">
          {heading}
        </h1>
        <p className="font-body-lg text-on-surface-variant mx-auto mt-2 max-w-xl text-base">
          {subtitle}
        </p>
      </div>

      {/* Tarjetas de Canales de Contacto */}
      <div className="gap-space-lg grid grid-cols-1 md:grid-cols-2">
        {/* Canal WhatsApp */}
        <div className="bg-surface-container-lowest border-outline-variant/30 flex flex-col justify-between rounded-2xl border p-8 shadow-sm">
          <div>
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#25D366]/15 text-[#25D366]">
              <MessageCircle className="h-7 w-7" />
            </div>
            <h2 className="font-headline-sm text-on-surface text-xl font-bold">{whatsappTitle}</h2>
            <p className="font-spec-numerical text-secondary mt-1 text-sm font-semibold">
              +{dealerConfig.whatsappNumber}
            </p>
            <p className="font-body-md text-on-surface-variant mt-3 text-sm leading-relaxed">
              {whatsappDescription}
            </p>
          </div>

          <div className="mt-8 pt-4">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-label-lg inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#1EBE5D] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#25D366]"
            >
              <MessageCircle className="h-4 w-4" />
              <span>{whatsappButtonText}</span>
            </a>
          </div>
        </div>

        {/* Canal Instagram */}
        <div className="bg-surface-container-lowest border-outline-variant/30 flex flex-col justify-between rounded-2xl border p-8 shadow-sm">
          <div>
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E4405F]/15 text-[#E4405F]">
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
                className="h-7 w-7 shrink-0 text-[#E4405F]"
              >
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
              </svg>
            </div>
            <h2 className="font-headline-sm text-on-surface text-xl font-bold">{instagramTitle}</h2>
            <p className="font-spec-numerical text-secondary mt-1 text-sm font-semibold">
              {siteContent.defaultFallbackSocials.instagramHandle}
            </p>
            <p className="font-body-md text-on-surface-variant mt-3 text-sm leading-relaxed">
              {instagramDescription}
            </p>
          </div>

          <div className="mt-8 pt-4">
            <a
              href={dealerConfig.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-label-lg border-outline-variant/60 hover:bg-surface-container-low text-on-surface focus-visible:outline-primary inline-flex w-full items-center justify-center gap-2 rounded-xl border bg-transparent px-5 py-3 text-sm font-bold shadow-sm transition focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <span>{instagramButtonText}</span>
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>

      {/* TODO(owner): agregar bloque de ubicación física, horario y mapa cuando el concesionario los defina */}
    </div>
  );
}
