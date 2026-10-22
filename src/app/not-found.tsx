import type { Metadata } from 'next';
import { ErrorScreen } from '@/components/layout/ErrorScreen';
import { siteContent } from '@/lib/site-content';

export const metadata: Metadata = {
  title: siteContent.errorPages.notFoundTitle,
};

export default function NotFound() {
  return <ErrorScreen variant="not-found" />;
}
