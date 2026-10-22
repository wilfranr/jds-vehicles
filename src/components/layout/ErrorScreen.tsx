import React from 'react';
import Link from 'next/link';
import { AlertCircle, Car, MessageCircle, RotateCcw } from 'lucide-react';
import { siteContent } from '@/lib/site-content';
import { buildWhatsAppUrl, getPublicWhatsAppNumber } from '@/lib/whatsapp';

interface ErrorScreenProps {
  variant: 'not-found' | 'error';
  /** Solo para `error`: reintenta renderizar el segmento. */
  onRetry?: () => void;
}

const actionBase =
  'font-label-md focus-visible:ring-primary flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none';

/** Pantalla de 404 y de error con el estilo del sistema de diseño; compartida por los archivos de convención de Next. */
export function ErrorScreen({ variant, onRetry }: ErrorScreenProps) {
  const copy = siteContent.errorPages;
  const isError = variant === 'error';
  const whatsappUrl = buildWhatsAppUrl(getPublicWhatsAppNumber(), copy.whatsappMessage);

  return (
    <main className="px-gutter py-space-xl mx-auto flex min-h-screen max-w-7xl flex-col items-center justify-center text-center">
      <div
        className={`mb-4 flex h-16 w-16 items-center justify-center rounded-full ${
          isError ? 'bg-error-container text-on-error-container' : 'bg-surface-container'
        }`}
      >
        {isError ? (
          <AlertCircle className="h-8 w-8" />
        ) : (
          <Car className="text-on-surface-variant h-8 w-8" />
        )}
      </div>
      <h1 className="font-headline-sm text-on-surface mb-2 text-2xl font-bold sm:text-3xl">
        {isError ? copy.errorTitle : copy.notFoundTitle}
      </h1>
      <p className="font-body-md text-on-surface-variant mb-6 max-w-md text-sm">
        {isError ? copy.errorDescription : copy.notFoundDescription}
      </p>
      <div className="flex w-full max-w-sm flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
        {isError && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className={`${actionBase} bg-primary text-on-primary shadow-sm hover:bg-neutral-800`}
          >
            <RotateCcw className="h-4 w-4" />
            <span>{copy.retryCta}</span>
          </button>
        )}
        <Link
          href="/catalogo"
          className={`${actionBase} ${
            isError
              ? 'bg-surface-container text-on-surface hover:bg-surface-container-high'
              : 'bg-primary text-on-primary shadow-sm hover:bg-neutral-800'
          }`}
        >
          <Car className="h-4 w-4" />
          <span>{copy.catalogCta}</span>
        </Link>
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`${actionBase} bg-surface-container text-on-surface hover:bg-surface-container-high`}
        >
          <MessageCircle className="h-4 w-4" />
          <span>{copy.whatsappCta}</span>
        </a>
      </div>
    </main>
  );
}
