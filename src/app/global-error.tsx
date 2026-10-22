'use client';

import { useEffect } from 'react';
import { ErrorScreen } from '@/components/layout/ErrorScreen';
import './globals.css';

// Reemplaza al layout raíz cuando este falla, por eso define su propio <html> y <body>.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Error global de aplicación:', error);
  }, [error]);

  return (
    <html lang="es">
      <body className="bg-background text-on-surface font-body-md min-h-screen antialiased">
        <ErrorScreen variant="error" onRetry={reset} />
      </body>
    </html>
  );
}
