import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { siteContent } from '@/lib/site-content';
import { WhatsAppIcon, InstagramIcon } from '@/components/ui/BrandIcons';
import { buildWhatsAppUrl } from '@/lib/whatsapp';

interface SiteFooterProps {
  whatsappNumber: string;
  instagramUrl: string;
}

const CURRENT_YEAR = new Date().getFullYear();

export function SiteFooter({ whatsappNumber, instagramUrl }: SiteFooterProps) {
  const whatsappUrl = buildWhatsAppUrl(whatsappNumber, siteContent.defaultWhatsAppMessage);

  return (
    <footer className="bg-surface-container-lowest border-outline-variant/30 w-full border-t shadow-[0_-1px_8px_rgba(0,0,0,0.03)]">
      <div className="px-gutter py-space-xl gap-space-xl mx-auto flex max-w-7xl flex-col">
        <div className="gap-space-lg grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          {/* 1. Marca y descripción */}
          <div className="gap-space-sm flex flex-col">
            <Link
              href="/"
              className="gap-space-xs focus-visible:ring-primary flex items-center rounded focus-visible:ring-2 focus-visible:outline-none"
              aria-label={`Inicio - ${siteContent.businessName}`}
            >
              <Image
                src="/logo.jpg"
                alt={`Logo de ${siteContent.businessName}`}
                width={28}
                height={28}
                className="h-7 w-auto rounded-full object-contain"
              />
              <span className="font-headline-sm text-headline-sm text-on-surface">
                {siteContent.businessName}
              </span>
            </Link>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              {siteContent.shortDescription}
            </p>
          </div>

          {/* 2. Navegación */}
          <div className="gap-space-xs flex flex-col">
            <span className="font-label-lg text-label-lg text-on-surface">Navegación</span>
            <ul className="gap-space-xs m-0 flex list-none flex-col p-0">
              {siteContent.navLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface focus-visible:ring-primary rounded transition-colors focus-visible:ring-2 focus-visible:outline-none"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* 3. Atención Concierge */}
          <div className="gap-space-xs flex flex-col">
            <span className="font-label-lg text-label-lg text-on-surface">Atención Concierge</span>
            <div className="gap-space-xs flex flex-col">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="gap-space-xs text-on-surface focus-visible:ring-primary flex items-center rounded transition-colors hover:text-[#25D366] focus-visible:ring-2 focus-visible:outline-none"
                aria-label={`Contactar por WhatsApp al ${whatsappNumber}`}
              >
                <WhatsAppIcon className="h-5 w-5 shrink-0 text-[#25D366]" />
                <span className="font-spec-numerical text-spec-numerical">+{whatsappNumber}</span>
              </a>

              <a
                href={instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="gap-space-xs text-on-surface focus-visible:ring-primary mt-1 flex items-center rounded transition-colors hover:text-[#E4405F] focus-visible:ring-2 focus-visible:outline-none"
                aria-label={`Visitar perfil de Instagram ${siteContent.defaultFallbackSocials.instagramHandle}`}
              >
                <InstagramIcon className="h-5 w-5 shrink-0 text-[#E4405F]" />
                <span className="font-spec-numerical text-spec-numerical">
                  {siteContent.defaultFallbackSocials.instagramHandle}
                </span>
              </a>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
              Línea directa WhatsApp y asesoría comercial personalizada.
            </p>
          </div>

          {/* 4. Legal y Garantías (solo si hay enlaces definidos) */}
          {siteContent.footerLinks.length > 0 && (
            <div className="gap-space-xs flex flex-col">
              <span className="font-label-lg text-label-lg text-on-surface">Legal y Garantías</span>
              <ul className="gap-space-xs m-0 flex list-none flex-col p-0">
                {siteContent.footerLinks.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface focus-visible:ring-primary rounded transition-colors focus-visible:ring-2 focus-visible:outline-none"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Barra inferior de Copyright */}
        <div className="pt-space-md border-outline-variant/30 bg-surface-container-lowest text-on-surface-variant font-body-sm text-body-sm gap-space-sm flex flex-col items-center justify-between border-t sm:flex-row">
          <p>
            © {CURRENT_YEAR} {siteContent.businessName}. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
