import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { UserRowActions } from '@/components/admin/UserRowActions';
import { formatDateTime } from '@/lib/format';
import { siteContent } from '@/lib/site-content';
import { listAdminUsers, ROLE_NAMES } from '@/server/admin/users';
import { requireAdmin } from '@/server/auth/staff';
import { resetPasswordAction, setActiveAction, setRoleAction } from './actions';

const copy = siteContent.adminUsers;

export const metadata: Metadata = { title: copy.title };

type Raw = Record<string, string | string[] | undefined>;

function one(raw: Raw, key: string): string | undefined {
  const value = raw[key];
  return Array.isArray(value) ? value[0] : value;
}

const fieldClass =
  'bg-surface-container-low text-on-surface focus-visible:ring-primary w-full rounded-lg border border-outline-variant/40 px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none';
const linkClass =
  'border-outline-variant/40 text-on-surface hover:bg-surface-container-low focus-visible:ring-primary rounded-lg border px-4 py-2 text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none';

const roles = ROLE_NAMES.map((value) => ({ value, label: copy.roleLabels[value] }));

// La tabla va en un contenedor `relative` con desplazamiento: los elementos `sr-only` (absolutos) de las filas
// quedan contenidos y recortados en lugar de ensanchar la página a 360 px.
export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<Raw> }) {
  // Solo ADMIN: un ASESOR o un CLIENTE recibe 404 (además del proxy).
  const admin = await requireAdmin('/admin/usuarios');
  const raw = await searchParams;
  const q = one(raw, 'q')?.slice(0, 150);
  const pageParam = one(raw, 'pagina');
  const { items, page, pageCount } = await listAdminUsers({
    q,
    page: pageParam && /^[1-9]\d{0,5}$/.test(pageParam) ? Number(pageParam) : 1,
  });

  const pageHref = (target: number) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (target > 1) params.set('pagina', String(target));
    const query = params.toString();
    return query ? `/admin/usuarios?${query}` : '/admin/usuarios';
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-headline-xl text-on-surface text-3xl font-extrabold tracking-tight">
        {copy.title}
      </h1>

      <form
        method="get"
        action="/admin/usuarios"
        role="search"
        className="bg-surface-container-lowest border-outline-variant/30 flex flex-wrap items-end gap-3 rounded-2xl border p-4"
      >
        <div className="min-w-0 flex-1 basis-60">
          <label htmlFor="u-q" className="text-sm font-semibold">
            {copy.filters.search}
          </label>
          <input
            id="u-q"
            name="q"
            defaultValue={q}
            placeholder={copy.filters.searchPlaceholder}
            maxLength={150}
            className={fieldClass}
          />
        </div>
        <button
          type="submit"
          className="bg-primary text-on-primary focus-visible:ring-primary rounded-lg px-4 py-2 text-sm font-semibold hover:bg-neutral-800 focus-visible:ring-2 focus-visible:outline-none"
        >
          {copy.filters.apply}
        </button>
        <Link href="/admin/usuarios" className={linkClass}>
          {copy.filters.clear}
        </Link>
      </form>

      {items.length === 0 ? (
        <p className="text-on-surface-variant text-sm">{copy.empty}</p>
      ) : (
        <div className="bg-surface-container-lowest border-outline-variant/30 relative overflow-x-auto rounded-2xl border">
          <table aria-label={copy.listLabel} className="w-full min-w-[52rem] text-left text-sm">
            <thead className="bg-surface-container-low text-on-surface-variant text-xs">
              <tr>
                <th scope="col" className="px-4 py-3">
                  {copy.columns.user}
                </th>
                <th scope="col" className="px-4 py-3">
                  {copy.columns.document}
                </th>
                <th scope="col" className="px-4 py-3">
                  {copy.columns.role}
                </th>
                <th scope="col" className="px-4 py-3">
                  {copy.columns.status}
                </th>
                <th scope="col" className="px-4 py-3">
                  {copy.columns.joined}
                </th>
                <th scope="col" className="px-4 py-3">
                  {copy.columns.actions}
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((u) => (
                <tr key={u.id} className="border-outline-variant/20 border-t align-top">
                  <th scope="row" className="px-4 py-3 font-semibold">
                    {u.nombre}{' '}
                    {u.id === admin.id && <span className="font-normal">{copy.you}</span>}
                    <span className="text-on-surface-variant block text-xs font-normal break-all">
                      {u.email}
                    </span>
                  </th>
                  <td className="font-spec-numerical px-4 py-3">{u.documentoEnmascarado}</td>
                  <td className="px-4 py-3">{copy.roleLabels[u.rol]}</td>
                  <td className="px-4 py-3">{u.activo ? copy.active : copy.inactive}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(u.createdAt)}</td>
                  <td className="px-4 py-3">
                    <UserRowActions
                      userId={u.id}
                      userName={u.nombre}
                      isSelf={u.id === admin.id}
                      active={u.activo}
                      role={u.rol}
                      roles={roles}
                      setRole={setRoleAction.bind(null, u.id)}
                      setActive={setActiveAction.bind(null, u.id, !u.activo)}
                      resetPassword={resetPasswordAction.bind(null, u.id)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pageCount > 1 && (
        <nav aria-label={copy.listLabel} className="flex items-center justify-between gap-3">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className={linkClass}>
              {copy.previousPage}
            </Link>
          ) : (
            <span />
          )}
          <span className="text-on-surface-variant text-sm">
            {copy.pageOf.replace('{page}', String(page)).replace('{total}', String(pageCount))}
          </span>
          {page < pageCount ? (
            <Link href={pageHref(page + 1)} className={linkClass}>
              {copy.nextPage}
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
