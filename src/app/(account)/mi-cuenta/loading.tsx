import React from 'react';
import { siteContent } from '@/lib/site-content';

export default function AccountLoading() {
  return (
    <div
      role="status"
      aria-label={siteContent.account.loading}
      className="bg-surface-container-lowest border-outline-variant/30 h-72 animate-pulse rounded-2xl border"
    />
  );
}
