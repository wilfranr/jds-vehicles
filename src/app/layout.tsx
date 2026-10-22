import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { siteContent } from '@/lib/site-content';
import { getSiteUrl } from '@/lib/site-url';
import './globals.css';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
  variable: '--font-plus-jakarta-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: siteContent.seo.defaultTitle,
    template: siteContent.seo.titleTemplate,
  },
  description: siteContent.seo.siteDescription,
  applicationName: siteContent.businessName,
  icons: { icon: '/favicon.ico', apple: '/logo.jpg' },
  openGraph: {
    type: 'website',
    siteName: siteContent.businessName,
    locale: siteContent.seo.locale,
    title: siteContent.seo.defaultTitle,
    description: siteContent.seo.siteDescription,
    images: [{ url: '/logo.jpg' }],
  },
  twitter: {
    card: 'summary',
    title: siteContent.seo.defaultTitle,
    description: siteContent.seo.siteDescription,
    images: ['/logo.jpg'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={plusJakartaSans.variable}>
      <body className="bg-background text-on-surface font-body-md min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
