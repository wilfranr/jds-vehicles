import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { NameForm } from '@/components/admin/NameForm';
import { ToggleForm } from '@/components/admin/ToggleForm';
import { siteContent } from '@/lib/site-content';
import { listBrandsWithModels } from '@/server/admin/catalog-admin';
import { requireStaff } from '@/server/auth/staff';
import {
  createBrandAction,
  createModelAction,
  renameBrandAction,
  renameModelAction,
  setBrandActiveAction,
  setModelActiveAction,
} from '../actions';

const copy = siteContent.adminVehicles;
const t = copy.brands;

export const metadata: Metadata = { title: copy.brandsTitle };

export default async function BrandsPage() {
  await requireStaff('/admin/vehiculos/marcas');
  const brands = await listBrandsWithModels();

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Link
        href="/admin/vehiculos"
        className="text-secondary text-sm font-semibold hover:underline"
      >
        {copy.backToList}
      </Link>
      <h1 className="font-headline-xl text-on-surface text-3xl font-extrabold tracking-tight">
        {copy.brandsTitle}
      </h1>
      <p className="text-on-surface-variant text-sm">{t.notDeletable}</p>

      <section
        aria-labelledby="nueva-marca"
        className="bg-surface-container-lowest border-outline-variant/30 rounded-2xl border p-4"
      >
        <h2 id="nueva-marca" className="font-headline-sm mb-2 text-lg font-bold">
          {t.newBrand}
        </h2>
        <NameForm
          action={createBrandAction}
          label={t.brandName}
          submitLabel={t.add}
          inputId="nueva-marca-nombre"
        />
      </section>

      <ul className="flex flex-col gap-4">
        {brands.map((brand) => (
          <li key={brand.id}>
            <section
              aria-labelledby={`marca-${brand.id}`}
              className="bg-surface-container-lowest border-outline-variant/30 flex flex-col gap-3 rounded-2xl border p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id={`marca-${brand.id}`} className="font-headline-sm text-lg font-bold">
                  {brand.nombre}{' '}
                  <span className="text-on-surface-variant text-xs font-normal">
                    · {brand.activo ? t.active : t.inactive} · {brand.vehicleCount} {t.vehicles}
                  </span>
                </h2>
                <ToggleForm
                  action={setBrandActiveAction.bind(null, !brand.activo)}
                  id={brand.id}
                  label={brand.activo ? t.deactivate : t.activate}
                />
              </div>
              <NameForm
                action={renameBrandAction}
                label={`${t.rename}: ${brand.nombre}`}
                submitLabel={t.rename}
                defaultValue={brand.nombre}
                hidden={{ id: brand.id }}
                inputId={`marca-nombre-${brand.id}`}
              />

              {brand.modelos.length === 0 ? (
                <p className="text-on-surface-variant text-sm">{t.noModels}</p>
              ) : (
                <ul className="border-outline-variant/20 flex flex-col gap-3 border-t pt-3">
                  {brand.modelos.map((model) => (
                    <li key={model.id} className="flex flex-col gap-2">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span className="font-semibold">
                          {model.nombre}{' '}
                          <span className="text-on-surface-variant text-xs font-normal">
                            · {model.activo ? t.active : t.inactive} · {model.vehicleCount}{' '}
                            {t.vehicles}
                          </span>
                        </span>
                        <ToggleForm
                          action={setModelActiveAction.bind(null, !model.activo)}
                          id={model.id}
                          label={model.activo ? t.deactivate : t.activate}
                        />
                      </div>
                      <NameForm
                        action={renameModelAction}
                        label={`${t.rename}: ${brand.nombre} ${model.nombre}`}
                        submitLabel={t.rename}
                        defaultValue={model.nombre}
                        hidden={{ id: model.id }}
                        inputId={`modelo-nombre-${model.id}`}
                      />
                    </li>
                  ))}
                </ul>
              )}
              <div className="border-outline-variant/20 border-t pt-3">
                <NameForm
                  action={createModelAction}
                  label={`${t.newModel}: ${brand.nombre}`}
                  submitLabel={t.add}
                  hidden={{ marcaId: brand.id }}
                  inputId={`nuevo-modelo-${brand.id}`}
                />
              </div>
            </section>
          </li>
        ))}
      </ul>
    </div>
  );
}
