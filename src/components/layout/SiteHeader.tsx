import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Search } from 'lucide-react';
import { siteContent } from '@/lib/site-content';
import { WhatsAppIcon, InstagramIcon } from '@/components/ui/BrandIcons';
import { buildWhatsAppUrl } from '@/lib/whatsapp';
import { MobileMenu } from './MobileMenu';

interface SiteHeaderProps {
  whatsappNumber: string;
  instagramUrl: string;
}

export function SiteHeader({ whatsappNumber, instagramUrl }: SiteHeaderProps) {
  const whatsappUrl = buildWhatsAppUrl(whatsappNumber, siteContent.defaultWhatsAppMessage);

  return (
    <header className="bg-surface-container-lowest/90 border-outline-variant/20 fixed top-0 right-0 left-0 z-50 border-b shadow-[0_1px_8px_rgba(0,0,0,0.04)] backdrop-blur-xl">
      <div className="px-gutter gap-space-md mx-auto flex h-20 max-w-7xl items-center justify-between">
        {/* Logo y Nombre + Navegación Desktop */}
        <div className="gap-space-lg flex items-center">
          <Link
            href="/"
            className="gap-space-xs focus-visible:ring-primary flex items-center rounded focus-visible:ring-2 focus-visible:outline-none"
            aria-label={`Inicio - ${siteContent.businessName}`}
          >
            <Image
              src="/logo.jpg"
              alt={`Logo de ${siteContent.businessName}`}
              width={32}
              height={32}
              priority
              className="h-8 w-auto rounded-full object-contain"
            />
            <span className="font-headline-sm text-headline-sm text-on-surface hidden tracking-tight sm:inline">
              {siteContent.businessName}
            </span>
          </Link>

          {/* Navegación Desktop */}
          <nav
            aria-label="Navegación principal"
            className="gap-space-xs hidden items-center xl:flex"
          >
            {siteContent.navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="font-label-lg text-label-lg px-space-md py-space-xs text-on-surface-variant hover:text-on-surface focus-visible:ring-primary rounded-lg transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Acciones del Header: Buscador GET, Redes, WhatsApp y Menú Móvil */}
        <div className="gap-space-md flex items-center">
          {/* Buscador Desktop (GET sin JS obligatorio) */}
          <form
            action="/catalogo"
            method="GET"
            role="search"
            className="bg-surface-container-low px-space-md py-space-xs focus-within:border-outline focus-within:ring-primary hidden w-64 items-center rounded-lg border border-transparent focus-within:ring-1 md:flex"
          >
            <label htmlFor="header-search-input" className="sr-only">
              Buscar modelo, marca o referencia
            </label>
            <Search className="text-on-surface-variant mr-space-xs h-4 w-4 shrink-0" />
            <input
              id="header-search-input"
              type="text"
              name="q"
              placeholder="Buscar modelo, marca o ref..."
              className="font-body-sm text-body-sm text-on-surface placeholder:text-outline w-full border-0 bg-transparent outline-none"
            />
          </form>

          {/* Botón WhatsApp Desktop (pastilla verde con pulsador) */}
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Contactar a JDS Vehículos por WhatsApp"
            className="gap-space-xs text-label-md font-label-md focus-visible:ring-primary hidden items-center rounded-full bg-[#25D366] px-3.5 py-1.5 text-white shadow-sm transition-all hover:bg-[#20bd5a] focus-visible:ring-2 focus-visible:outline-none sm:inline-flex"
          >
            <WhatsAppIcon className="h-4 w-4 shrink-0 fill-white" />
            <span>WhatsApp</span>
          </a>

          {/* Enlace Instagram */}
          <a
            href={instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:bg-surface-container-low text-on-surface-variant focus-visible:ring-primary flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:text-[#E4405F] focus-visible:ring-2 focus-visible:outline-none"
            aria-label={`Visitar perfil de Instagram ${siteContent.defaultFallbackSocials.instagramHandle}`}
          >
            <InstagramIcon className="h-5 w-5 shrink-0" />
          </a>

          {/* TODO(F2): Iniciar sesión con Auth.js cuando esté implementado */}

          {/* Menú móvil accesible */}
          <MobileMenu whatsappNumber={whatsappNumber} instagramUrl={instagramUrl} />
        </div>
      </div>
    </header>
  );
}
