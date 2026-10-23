import React from 'react';
import type { Metadata } from 'next';
import { ConfigForm } from '@/components/admin/ConfigForm';
import { siteContent } from '@/lib/site-content';
import { CONFIG_KEYS } from '@/lib/validation/dealer-config';
import { listAdminConfig } from '@/server/admin/dealer-config';
import { requireAdmin } from '@/server/auth/staff';
import { updateConfigAction } from './actions';

const copy = siteContent.adminConfig;

export const metadata: Metadata = { title: copy.title };

export default async function AdminConfigPage() {
  // Solo ADMIN: un ASESOR o un CLIENTE recibe 404 (además del proxy).
  await requireAdmin('/admin/configuracion');
  const entries = await listAdminConfig(CONFIG_KEYS);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="font-headline-xl text-on-surface text-3xl font-extrabold tracking-tight">
          {copy.title}
        </h1>
        <p className="text-on-surface-variant mt-1 text-sm">{copy.intro}</p>
      </div>
      {entries.map((entry) => (
        <ConfigForm
          key={entry.key}
          configKey={entry.key}
          currentValue={entry.effective}
          isFallback={entry.stored === null}
          action={updateConfigAction.bind(null, entry.key)}
        />
      ))}
    </div>
  );
}
