import React from 'react';
import { SiteShell } from '@/components/layout/SiteShell';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <SiteShell readSession={false}>{children}</SiteShell>;
}
