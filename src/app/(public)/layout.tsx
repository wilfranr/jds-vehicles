import React from 'react';
import { SiteShell } from '@/components/layout/SiteShell';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <SiteShell>{children}</SiteShell>;
}
