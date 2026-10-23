import React from 'react';
import type { EstadoReserva } from '@prisma/client';
import { siteContent } from '@/lib/site-content';

const classes: Record<EstadoReserva, string> = {
  PENDIENTE_CONTACTO: 'bg-status-reservado-bg text-status-reservado border-status-reservado-border',
  EN_NEGOCIACION: 'bg-status-seminuevo-bg text-status-seminuevo border-status-seminuevo-border',
  COMPLETADA: 'bg-status-nuevo-bg text-status-nuevo border-status-nuevo-border',
  CANCELADA: 'bg-error-container text-on-error-container border-error/30',
  EXPIRADA: 'bg-status-vendido-bg text-status-vendido border-status-vendido-border',
};

/** Estado de la reserva como texto (nunca solo color). Colores con contraste AA, tomados de los tokens de estado. */
export function ReservationStatusChip({ estado }: { estado: EstadoReserva }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${classes[estado]}`}
    >
      {siteContent.cuenta.reservations.statusLabels[estado]}
    </span>
  );
}
