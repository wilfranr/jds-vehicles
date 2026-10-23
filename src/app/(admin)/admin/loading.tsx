import React from 'react';
import { siteContent } from '@/lib/site-content';

export default function AdminLoading() {
  return (
    <div
      role="status"
      aria-label={siteContent.admin.skipLabel}
      className="bg-surface-container-lowest border-outline-variant/30 h-64 animate-pulse rounded-2xl border"
    />
  );
}
