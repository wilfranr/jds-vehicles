'use client';

import { useEffect } from 'react';
import { ErrorScreen } from '@/components/layout/ErrorScreen';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Error de aplicación:', error);
  }, [error]);

  return <ErrorScreen variant="error" onRetry={reset} />;
}
