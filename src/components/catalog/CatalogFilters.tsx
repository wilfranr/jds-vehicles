'use client';

import React, { useState, useId } from 'react';
import Link from 'next/link';
import { SlidersHorizontal, X, RotateCcw } from 'lucide-react';
import { type CatalogFilterOptions } from '@/types/catalog';
import { type NormalizedCatalogFilters } from '@/server/catalog/filters';
import { Condicion, Transmision, Combustible } from '@prisma/client';

interface CatalogFiltersProps {
  options: CatalogFilterOptions;
  currentFilters: NormalizedCatalogFilters;
}

export function CatalogFilters({ options, currentFilters }: CatalogFiltersProps) {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const selectedMarcaId = currentFilters.marca;

  // Filtrar modelos disponibles para la marca seleccionada
  const availableModels = selectedMarcaId
    ? options.marcas.find((b) => b.id === selectedMarcaId)?.modelos || []
    : options.marcas.flatMap((b) => b.modelos);

  // Generar IDs únicos para accesibilidad
  const marcaSelectId = useId();
  const modeloSelectId = useId();
  const precioMinId = useId();
  const precioMaxId = useId();
  const anioMinId = useId();
  const anioMaxId = useId();
  const colorSelectId = useId();
  const transmisionSelectId = useId();
  const combustibleSelectId = useId();
  const ordenSelectId = useId();

  // Calcular cantidad de filtros activos
  const activeChips: { label: string; paramKey: keyof NormalizedCatalogFilters }[] = [];

  if (currentFilters.q) {
    activeChips.push({ label: `Búsqueda: "${currentFilters.q}"`, paramKey: 'q' });
  }
  if (currentFilters.condicion) {
    activeChips.push({
      label: currentFilters.condicion === Condicion.NUEVO ? 'Nuevo' : 'Seminuevo',
      paramKey: 'condicion',
    });
  }
  if (currentFilters.marca) {
    const brandName = options.marcas.find((m) => m.id === currentFilters.marca)?.nombre;
    if (brandName) activeChips.push({ label: `Marca: ${brandName}`, paramKey: 'marca' });
  }
  if (currentFilters.modelo) {
    const modelName = availableModels.find((m) => m.id === currentFilters.modelo)?.nombre;
    if (modelName) activeChips.push({ label: `Modelo: ${modelName}`, paramKey: 'modelo' });
  }
  if (currentFilters.precioMin) {
    activeChips.push({
      label: `Desde $${(currentFilters.precioMin / 1000000).toFixed(0)}M`,
      paramKey: 'precioMin',
    });
  }
  if (currentFilters.precioMax) {
    activeChips.push({
      label: `Hasta $${(currentFilters.precioMax / 1000000).toFixed(0)}M`,
      paramKey: 'precioMax',
    });
  }
  if (currentFilters.anioMin) {
    activeChips.push({ label: `Año ≥ ${currentFilters.anioMin}`, paramKey: 'anioMin' });
  }
  if (currentFilters.anioMax) {
    activeChips.push({ label: `Año ≤ ${currentFilters.anioMax}`, paramKey: 'anioMax' });
  }
  if (currentFilters.color) {
    activeChips.push({ label: `Color: ${currentFilters.color}`, paramKey: 'color' });
  }
  if (currentFilters.transmision) {
    activeChips.push({
      label: currentFilters.transmision.toLowerCase(),
      paramKey: 'transmision',
    });
  }
  if (currentFilters.combustible) {
    activeChips.push({
      label: currentFilters.combustible.toLowerCase(),
      paramKey: 'combustible',
    });
  }

  // Generador de URL para remover un chip específico
  const getRemoveFilterUrl = (paramToRemove: keyof NormalizedCatalogFilters) => {
    const params = new URLSearchParams();
    if (currentFilters.q && paramToRemove !== 'q') params.set('q', currentFilters.q);
    if (currentFilters.condicion && paramToRemove !== 'condicion')
      params.set('condicion', currentFilters.condicion);
    if (currentFilters.marca && paramToRemove !== 'marca')
      params.set('marca', String(currentFilters.marca));
    if (currentFilters.modelo && paramToRemove !== 'modelo' && paramToRemove !== 'marca')
      params.set('modelo', String(currentFilters.modelo));
    if (currentFilters.precioMin && paramToRemove !== 'precioMin')
      params.set('precioMin', String(currentFilters.precioMin));
    if (currentFilters.precioMax && paramToRemove !== 'precioMax')
      params.set('precioMax', String(currentFilters.precioMax));
    if (currentFilters.anioMin && paramToRemove !== 'anioMin')
      params.set('anioMin', String(currentFilters.anioMin));
    if (currentFilters.anioMax && paramToRemove !== 'anioMax')
      params.set('anioMax', String(currentFilters.anioMax));
    if (currentFilters.color && paramToRemove !== 'color')
      params.set('color', currentFilters.color);
    if (currentFilters.transmision && paramToRemove !== 'transmision')
      params.set('transmision', currentFilters.transmision);
    if (currentFilters.combustible && paramToRemove !== 'combustible')
      params.set('combustible', currentFilters.combustible);
    if (currentFilters.orden && currentFilters.orden !== 'recientes')
      params.set('orden', currentFilters.orden);

    const qs = params.toString();
    return `/catalogo${qs ? `?${qs}` : ''}`;
  };

  const formContent = (
    <div className="gap-space-md text-on-surface flex flex-col">
      {/* Condición (Chips: Todos / Nuevo / Usado) */}
      <fieldset className="m-0 flex flex-col gap-1 border-0 p-0">
        <legend className="font-label-md text-label-md text-on-surface tracking-wide uppercase">
          Condición
        </legend>
        <div className="bg-surface-container-low grid grid-cols-3 gap-1 rounded-lg p-1">
          <label className="cursor-pointer text-center">
            <input
              type="radio"
              name="condicion"
              value=""
              defaultChecked={!currentFilters.condicion}
              className="peer sr-only"
            />
            <span className="font-label-sm text-label-sm peer-checked:bg-primary peer-checked:text-on-primary text-on-surface-variant hover:text-on-surface block rounded py-1.5 text-center transition-all">
              Todos
            </span>
          </label>
          <label className="cursor-pointer text-center">
            <input
              type="radio"
              name="condicion"
              value={Condicion.NUEVO}
              defaultChecked={currentFilters.condicion === Condicion.NUEVO}
              className="peer sr-only"
            />
            <span className="font-label-sm text-label-sm peer-checked:bg-primary peer-checked:text-on-primary text-on-surface-variant hover:text-on-surface block rounded py-1.5 text-center transition-all">
              Nuevo
            </span>
          </label>
          <label className="cursor-pointer text-center">
            <input
              type="radio"
              name="condicion"
              value={Condicion.USADO}
              defaultChecked={currentFilters.condicion === Condicion.USADO}
              className="peer sr-only"
            />
            <span className="font-label-sm text-label-sm peer-checked:bg-primary peer-checked:text-on-primary text-on-surface-variant hover:text-on-surface block rounded py-1.5 text-center transition-all">
              Seminuevo
            </span>
          </label>
        </div>
      </fieldset>

      {/* Marca */}
      <div className="flex flex-col gap-1">
        <label
          htmlFor={marcaSelectId}
          className="font-label-md text-label-md text-on-surface tracking-wide uppercase"
        >
          Marca
        </label>
        <select
          id={marcaSelectId}
          name="marca"
          defaultValue={currentFilters.marca ? String(currentFilters.marca) : ''}
          className="bg-surface-container-low text-on-surface font-body-md focus:border-outline rounded-lg border border-transparent px-3 py-2 text-sm focus:outline-none"
        >
          <option value="">Todas las marcas</option>
          {options.marcas.map((b) => (
            <option key={b.id} value={b.id}>
              {b.nombre}
            </option>
          ))}
        </select>
      </div>

      {/* Modelo */}
      <div className="flex flex-col gap-1">
        <label
          htmlFor={modeloSelectId}
          className="font-label-md text-label-md text-on-surface tracking-wide uppercase"
        >
          Modelo
        </label>
        <select
          id={modeloSelectId}
          name="modelo"
          defaultValue={currentFilters.modelo ? String(currentFilters.modelo) : ''}
          className="bg-surface-container-low text-on-surface font-body-md focus:border-outline rounded-lg border border-transparent px-3 py-2 text-sm focus:outline-none"
        >
          <option value="">Todos los modelos</option>
          {availableModels.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nombre}
            </option>
          ))}
        </select>
      </div>

      {/* Rango de Precios */}
      <fieldset className="m-0 flex flex-col gap-1 border-0 p-0">
        <legend className="font-label-md text-label-md text-on-surface tracking-wide uppercase">
          Precio (COP)
        </legend>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor={precioMinId} className="sr-only">
              Precio Mínimo
            </label>
            <input
              id={precioMinId}
              type="number"
              name="precioMin"
              placeholder={`Mín: ${(options.precioMin / 1000000).toFixed(0)}M`}
              defaultValue={currentFilters.precioMin || ''}
              className="bg-surface-container-low font-body-md text-on-surface placeholder:text-outline focus:border-outline w-full rounded-lg border border-transparent px-2.5 py-2 text-xs focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor={precioMaxId} className="sr-only">
              Precio Máximo
            </label>
            <input
              id={precioMaxId}
              type="number"
              name="precioMax"
              placeholder={`Máx: ${(options.precioMax / 1000000).toFixed(0)}M`}
              defaultValue={currentFilters.precioMax || ''}
              className="bg-surface-container-low font-body-md text-on-surface placeholder:text-outline focus:border-outline w-full rounded-lg border border-transparent px-2.5 py-2 text-xs focus:outline-none"
            />
          </div>
        </div>
      </fieldset>

      {/* Rango de Años */}
      <fieldset className="m-0 flex flex-col gap-1 border-0 p-0">
        <legend className="font-label-md text-label-md text-on-surface tracking-wide uppercase">
          Año
        </legend>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor={anioMinId} className="sr-only">
              Año Mínimo
            </label>
            <input
              id={anioMinId}
              type="number"
              name="anioMin"
              placeholder={`Desde: ${options.anioMin}`}
              defaultValue={currentFilters.anioMin || ''}
              className="bg-surface-container-low font-body-md text-on-surface placeholder:text-outline focus:border-outline w-full rounded-lg border border-transparent px-2.5 py-2 text-xs focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor={anioMaxId} className="sr-only">
              Año Máximo
            </label>
            <input
              id={anioMaxId}
              type="number"
              name="anioMax"
              placeholder={`Hasta: ${options.anioMax}`}
              defaultValue={currentFilters.anioMax || ''}
              className="bg-surface-container-low font-body-md text-on-surface placeholder:text-outline focus:border-outline w-full rounded-lg border border-transparent px-2.5 py-2 text-xs focus:outline-none"
            />
          </div>
        </div>
      </fieldset>

      {/* Color */}
      <div className="flex flex-col gap-1">
        <label
          htmlFor={colorSelectId}
          className="font-label-md text-label-md text-on-surface tracking-wide uppercase"
        >
          Color
        </label>
        <select
          id={colorSelectId}
          name="color"
          defaultValue={currentFilters.color || ''}
          className="bg-surface-container-low text-on-surface font-body-md focus:border-outline rounded-lg border border-transparent px-3 py-2 text-sm focus:outline-none"
        >
          <option value="">Todos los colores</option>
          {options.colores.map((color) => (
            <option key={color} value={color}>
              {color}
            </option>
          ))}
        </select>
      </div>

      {/* Transmisión */}
      <div className="flex flex-col gap-1">
        <label
          htmlFor={transmisionSelectId}
          className="font-label-md text-label-md text-on-surface tracking-wide uppercase"
        >
          Transmisión
        </label>
        <select
          id={transmisionSelectId}
          name="transmision"
          defaultValue={currentFilters.transmision || ''}
          className="bg-surface-container-low text-on-surface font-body-md focus:border-outline rounded-lg border border-transparent px-3 py-2 text-sm focus:outline-none"
        >
          <option value="">Cualquiera</option>
          <option value={Transmision.AUTOMATICA}>Automática</option>
          <option value={Transmision.MANUAL}>Manual</option>
          <option value={Transmision.SECUENCIAL}>Secuencial</option>
        </select>
      </div>

      {/* Combustible */}
      <div className="flex flex-col gap-1">
        <label
          htmlFor={combustibleSelectId}
          className="font-label-md text-label-md text-on-surface tracking-wide uppercase"
        >
          Combustible
        </label>
        <select
          id={combustibleSelectId}
          name="combustible"
          defaultValue={currentFilters.combustible || ''}
          className="bg-surface-container-low text-on-surface font-body-md focus:border-outline rounded-lg border border-transparent px-3 py-2 text-sm focus:outline-none"
        >
          <option value="">Cualquiera</option>
          <option value={Combustible.GASOLINA}>Gasolina</option>
          <option value={Combustible.DIESEL}>Diésel</option>
          <option value={Combustible.HIBRIDO}>Híbrido</option>
          <option value={Combustible.ELECTRICO}>Eléctrico</option>
          <option value={Combustible.GAS}>Gas</option>
        </select>
      </div>

      {/* Orden */}
      <div className="flex flex-col gap-1">
        <label
          htmlFor={ordenSelectId}
          className="font-label-md text-label-md text-on-surface tracking-wide uppercase"
        >
          Ordenar por
        </label>
        <select
          id={ordenSelectId}
          name="orden"
          defaultValue={currentFilters.orden}
          className="bg-surface-container-low text-on-surface font-body-md focus:border-outline rounded-lg border border-transparent px-3 py-2 text-sm focus:outline-none"
        >
          <option value="recientes">Más recientes</option>
          <option value="precio_asc">Precio: menor a mayor</option>
          <option value="precio_desc">Precio: mayor a menor</option>
          <option value="anio_desc">Año: más nuevo primero</option>
        </select>
      </div>

      {/* Mantener término de búsqueda si existe */}
      {currentFilters.q && <input type="hidden" name="q" value={currentFilters.q} />}

      {/* Botón de Aplicar Filtros (esencial para funcionamiento sin JS) */}
      <button
        type="submit"
        className="bg-primary text-on-primary font-label-lg text-label-lg focus-visible:ring-primary mt-2 w-full rounded-lg px-4 py-2.5 shadow-sm transition-colors hover:bg-neutral-800 focus-visible:ring-2 focus-visible:outline-none"
      >
        Aplicar Filtros
      </button>
    </div>
  );

  return (
    <>
      {/* Disparador móvil (Botón flotante / barra inferior en pantallas pequeñas) */}
      <div className="mb-4 w-full lg:hidden">
        <button
          type="button"
          onClick={() => setMobileDrawerOpen(true)}
          className="bg-surface-container-lowest border-outline-variant/30 text-on-surface font-label-md flex w-full items-center justify-between rounded-xl border px-4 py-2.5 text-sm shadow-sm"
          aria-expanded={mobileDrawerOpen}
        >
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="text-on-surface-variant h-4 w-4" />
            <span>Filtros {activeChips.length > 0 && `(${activeChips.length})`}</span>
          </div>
          <span className="text-secondary text-xs font-semibold">Editar</span>
        </button>
      </div>

      {/* Panel Lateral de Escritorio (Sidebar) */}
      <aside
        aria-label="Filtros del catálogo"
        className="gap-space-md bg-surface-container-lowest p-space-md border-outline-variant/20 hidden w-72 shrink-0 flex-col rounded-xl border shadow-sm lg:flex"
      >
        <div className="border-outline-variant/20 flex items-center justify-between border-b pb-2">
          <div className="text-on-surface flex items-center gap-2">
            <SlidersHorizontal className="text-on-surface-variant h-5 w-5" />
            <h2 className="font-headline-sm text-lg font-bold">Filtros</h2>
          </div>
          {activeChips.length > 0 && (
            <Link
              href="/catalogo"
              className="font-label-sm text-secondary flex items-center gap-1 text-xs hover:underline"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Limpiar todo</span>
            </Link>
          )}
        </div>

        {/* Chips de filtros activos */}
        {activeChips.length > 0 && (
          <div
            className="border-outline-variant/20 flex flex-wrap gap-1.5 border-b pb-2"
            aria-label="Filtros aplicados"
          >
            {activeChips.map((chip) => (
              <Link
                key={chip.paramKey}
                href={getRemoveFilterUrl(chip.paramKey)}
                className="bg-surface-container text-on-surface hover:bg-surface-container-high inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs transition-colors"
                title={`Quitar filtro ${chip.label}`}
              >
                <span>{chip.label}</span>
                <X className="text-on-surface-variant h-3 w-3" />
              </Link>
            ))}
          </div>
        )}

        <form action="/catalogo" method="GET">
          {formContent}
        </form>
      </aside>

      {/* Drawer Móvil Modal */}
      {mobileDrawerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Filtros de búsqueda"
          className="bg-surface-container-lowest/98 fixed inset-0 z-50 flex flex-col overflow-y-auto p-6 backdrop-blur-xl lg:hidden"
        >
          <div className="border-outline-variant/30 flex items-center justify-between border-b pb-4">
            <h2 className="font-headline-sm text-on-surface text-lg font-bold">
              Filtros {activeChips.length > 0 && `(${activeChips.length})`}
            </h2>
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(false)}
              className="text-on-surface-variant hover:text-on-surface rounded-lg p-2"
              aria-label="Cerrar filtros"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <form action="/catalogo" method="GET" className="mt-4">
            {formContent}
          </form>
        </div>
      )}
    </>
  );
}
