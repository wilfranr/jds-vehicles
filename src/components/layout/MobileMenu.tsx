'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Menu, X, Search } from 'lucide-react';
import { siteContent } from '@/lib/site-content';
import { WhatsAppIcon, InstagramIcon } from '@/components/ui/BrandIcons';
import { buildWhatsAppUrl } from '@/lib/whatsapp';

interface MobileMenuProps {
  whatsappNumber: string;
  instagramUrl: string;
}

export function MobileMenu({ whatsappNumber, instagramUrl }: MobileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const whatsappUrl = buildWhatsAppUrl(whatsappNumber, siteContent.defaultWhatsAppMessage);

  const toggleMenu = () => setIsOpen((prev) => !prev);
  const closeMenu = () => {
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        closeMenu();
      }
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
      setTimeout(() => {
        closeButtonRef.current?.focus();
      }, 50);
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="flex items-center xl:hidden">
      <button
        ref={triggerRef}
        type="button"
        onClick={toggleMenu}
        aria-expanded={isOpen}
        aria-controls="mobile-navigation-menu"
        aria-label={isOpen ? 'Cerrar menú' : 'Abrir menú de navegación'}
        className="text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low focus-visible:ring-primary rounded-lg p-2 transition-colors focus-visible:ring-2 focus-visible:outline-none"
      >
        <Menu className="h-6 w-6" />
      </button>

      {isOpen && (
        <div
          id="mobile-navigation-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Menú principal de navegación"
          className="bg-surface-container-lowest/98 fixed inset-0 z-50 flex flex-col overflow-y-auto p-6 backdrop-blur-2xl"
        >
          {/* Header del menú móvil */}
          <div className="border-outline-variant/30 flex items-center justify-between border-b pb-6">
            <span className="font-headline-sm text-headline-sm text-on-surface">
              {siteContent.businessName}
            </span>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={closeMenu}
              aria-label="Cerrar menú"
              className="text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low focus-visible:ring-primary rounded-lg p-2 transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Buscador móvil */}
          <form action="/catalogo" method="GET" className="mt-6">
            <div className="relative flex items-center">
              <Search className="text-on-surface-variant pointer-events-none absolute left-3 h-5 w-5" />
              <input
                type="text"
                name="q"
                placeholder="Buscar modelo, marca o ref..."
                aria-label="Buscar en el catálogo"
                className="bg-surface-container-low font-body-md text-body-md text-on-surface placeholder:text-outline focus:border-outline focus:ring-primary w-full rounded-lg border border-transparent py-2.5 pr-4 pl-10 focus:ring-1 focus:outline-none"
              />
            </div>
          </form>

          {/* Enlaces de navegación */}
          <nav className="mt-6 flex flex-col gap-2">
            {siteContent.navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={closeMenu}
                className="font-label-lg text-label-lg text-on-surface hover:bg-surface-container-low focus-visible:ring-primary rounded-lg px-4 py-3 transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Contacto y redes en móvil */}
          <div className="border-outline-variant/30 mt-auto flex flex-col gap-4 border-t pt-6">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-label-lg focus-visible:ring-primary flex items-center justify-center gap-2 rounded-full bg-[#25D366] px-4 py-3 text-white transition-colors hover:bg-[#20bd5a] focus-visible:ring-2 focus-visible:outline-none"
            >
              <WhatsAppIcon className="h-5 w-5 fill-white" />
              <span>Contactar por WhatsApp</span>
            </a>

            <a
              href={instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-surface-container-low text-on-surface hover:bg-surface-container focus-visible:ring-primary flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              <InstagramIcon className="h-5 w-5 text-[#E4405F]" />
              <span className="font-label-md text-label-md">
                {siteContent.defaultFallbackSocials.instagramHandle}
              </span>
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
