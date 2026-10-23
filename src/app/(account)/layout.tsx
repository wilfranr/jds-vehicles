import React from 'react';
import { SiteShell } from '@/components/layout/SiteShell';

export default function AccountGroupLayout({ children }: { children: React.ReactNode }) {
  return <SiteShell>{children}</SiteShell>;
}
