'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Maximize2, X, Images } from 'lucide-react';
import type { VehiclePhotoData } from '@/types/catalog';
import { isLocalMedia, thumbOf } from '@/lib/media-url';
import { useFocusTrap } from '@/components/ui/useFocusTrap';

interface VehicleGalleryProps {
  photos: VehiclePhotoData[];
  title: string;
}

export function VehicleGallery({ photos, title }: VehicleGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const modalCloseBtnRef = useRef<HTMLButtonElement>(null);
  const openModalBtnRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, isFullScreen);

  const total = photos.length;
  const currentPhoto = photos[selectedIndex] || photos[0];

  const goPrev = React.useCallback(() => {
    setSelectedIndex((prev) => (prev > 0 ? prev - 1 : total - 1));
  }, [total]);

  const goNext = React.useCallback(() => {
    setSelectedIndex((prev) => (prev < total - 1 ? prev + 1 : 0));
  }, [total]);

  // Manejo de teclado (← y → para navegar, Esc para cerrar pantalla completa)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (total <= 1 && !isFullScreen) return;
      // Las flechas escriben en campos de texto y mueven listas: no deben cambiar de foto desde ahí.
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;

      if (e.key === 'ArrowLeft') {
        goPrev();
      } else if (e.key === 'ArrowRight') {
        goNext();
      } else if (e.key === 'Escape' && isFullScreen) {
        setIsFullScreen(false);
        openModalBtnRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [total, isFullScreen, goPrev, goNext]);

  // Atrapado de foco al abrir modal
  useEffect(() => {
    if (isFullScreen) {
      document.body.style.overflow = 'hidden';
      setTimeout(() => {
        modalCloseBtnRef.current?.focus();
      }, 50);
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isFullScreen]);

  if (!photos || photos.length === 0 || !currentPhoto) {
    return (
      <div className="bg-surface-container text-on-surface-variant border-outline-variant/30 relative flex aspect-[16/10] w-full flex-col items-center justify-center rounded-2xl border p-6">
        <Images className="mb-2 h-12 w-12 stroke-1" />
        <span className="font-body-md text-sm">Fotografías del vehículo en preparación</span>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-3">
      {/* Imagen Principal (16:10) */}
      <div className="bg-surface-container border-outline-variant/30 group relative aspect-[16/10] w-full overflow-hidden rounded-2xl border shadow-sm">
        <Image
          src={currentPhoto.url}
          unoptimized={isLocalMedia(currentPhoto.url)}
          alt={`${title} - Foto ${selectedIndex + 1} de ${total}`}
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 65vw"
          className="object-cover transition-opacity duration-300"
        />

        {/* Contador flotante 1/N con glassmorphism */}
        <div className="bg-surface-container-lowest/85 font-spec-numerical text-on-surface absolute bottom-4 left-4 z-10 flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold shadow-sm backdrop-blur-md">
          <Images className="text-on-surface-variant h-4 w-4" />
          <span>
            {selectedIndex + 1} / {total}
          </span>
        </div>

        {/* Botón Pantalla Completa */}
        <button
          ref={openModalBtnRef}
          type="button"
          onClick={() => setIsFullScreen(true)}
          className="bg-surface-container-lowest/85 text-on-surface hover:bg-surface-container-lowest focus-visible:ring-primary absolute right-4 bottom-4 z-10 rounded-full p-2 shadow-sm backdrop-blur-md transition-all focus-visible:ring-2 focus-visible:outline-none"
          aria-label="Ver fotografía en pantalla completa"
        >
          <Maximize2 className="h-4 w-4" />
        </button>

        {/* Botones de navegación sobre la imagen (si hay más de 1 foto) */}
        {total > 1 && (
          <>
            <button
              type="button"
              onClick={goPrev}
              className="bg-surface-container-lowest/80 text-on-surface hover:bg-surface-container-lowest focus-visible:ring-primary absolute top-1/2 left-3 z-10 -translate-y-1/2 rounded-full p-2 opacity-80 backdrop-blur-md transition-all hover:opacity-100 focus-visible:ring-2 focus-visible:outline-none"
              aria-label="Ver foto anterior"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={goNext}
              className="bg-surface-container-lowest/80 text-on-surface hover:bg-surface-container-lowest focus-visible:ring-primary absolute top-1/2 right-3 z-10 -translate-y-1/2 rounded-full p-2 opacity-80 backdrop-blur-md transition-all hover:opacity-100 focus-visible:ring-2 focus-visible:outline-none"
              aria-label="Ver siguiente foto"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
      </div>

      {/* Tira de Miniaturas */}
      {total > 1 && (
        <div
          role="region"
          aria-label="Galería de miniaturas"
          className="flex scrollbar-none items-center gap-2 overflow-x-auto pb-2"
        >
          {photos.map((photo, index) => {
            const isSelected = index === selectedIndex;
            return (
              <button
                key={photo.id || index}
                type="button"
                onClick={() => setSelectedIndex(index)}
                aria-label={`Seleccionar foto ${index + 1} de ${total}`}
                aria-current={isSelected ? 'true' : undefined}
                className={`focus-visible:ring-primary relative aspect-[16/10] w-20 shrink-0 overflow-hidden rounded-lg border-2 transition-all focus-visible:ring-2 focus-visible:outline-none sm:w-24 ${
                  isSelected
                    ? 'border-primary ring-primary/20 opacity-100 ring-2'
                    : 'border-transparent opacity-60 hover:opacity-100'
                }`}
              >
                <Image
                  src={thumbOf(photo.url)}
                  unoptimized={isLocalMedia(photo.url)}
                  alt={`${title} - Miniatura ${index + 1}`}
                  fill
                  sizes="100px"
                  className="object-cover"
                />
              </button>
            );
          })}
        </div>
      )}

      {/* Modal Pantalla Completa Accesible */}
      {isFullScreen && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={`Galería a pantalla completa: ${title}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4 backdrop-blur-md"
        >
          {/* Botón Cerrar */}
          <button
            ref={modalCloseBtnRef}
            type="button"
            onClick={() => {
              setIsFullScreen(false);
              openModalBtnRef.current?.focus();
            }}
            aria-label="Cerrar vista de pantalla completa"
            className="absolute top-6 right-6 z-50 rounded-full bg-white/10 p-2.5 text-white transition-all hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
          >
            <X className="h-6 w-6" />
          </button>

          {/* Imagen ampliada */}
          <div className="relative h-[80vh] w-[90vw] max-w-6xl">
            <Image
              src={currentPhoto.url}
              unoptimized={isLocalMedia(currentPhoto.url)}
              alt={`${title} - Foto ${selectedIndex + 1} de ${total}`}
              fill
              className="object-contain"
              sizes="90vw"
            />
          </div>

          {/* Navegación Modal */}
          {total > 1 && (
            <>
              <button
                type="button"
                onClick={goPrev}
                className="absolute top-1/2 left-4 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition-all hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
                aria-label="Ver foto anterior"
              >
                <ChevronLeft className="h-8 w-8" />
              </button>
              <button
                type="button"
                onClick={goNext}
                className="absolute top-1/2 right-4 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition-all hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
                aria-label="Ver siguiente foto"
              >
                <ChevronRight className="h-8 w-8" />
              </button>
            </>
          )}

          {/* Contador inferior modal */}
          <div className="font-spec-numerical absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-4 py-1.5 text-sm text-white backdrop-blur-md">
            {selectedIndex + 1} / {total}
          </div>
        </div>
      )}
    </div>
  );
}
