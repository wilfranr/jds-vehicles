import React from "react";

export type VehicleStatus =
  | "NUEVO"
  | "USADO"
  | "RESERVADO"
  | "VENDIDO"
  | "PROXIMAMENTE";

interface StatusBadgeProps {
  status: VehicleStatus;
  className?: string;
}

const statusConfig: Record<
  VehicleStatus,
  { label: string; bgClass: string; textClass: string; borderClass: string }
> = {
  NUEVO: {
    label: "NUEVO",
    bgClass: "bg-status-nuevo-bg",
    textClass: "text-status-nuevo",
    borderClass: "border-status-nuevo-border",
  },
  USADO: {
    label: "SEMINUEVO",
    bgClass: "bg-status-seminuevo-bg",
    textClass: "text-status-seminuevo",
    borderClass: "border-status-seminuevo-border",
  },
  RESERVADO: {
    label: "RESERVADO",
    bgClass: "bg-status-reservado-bg",
    textClass: "text-status-reservado",
    borderClass: "border-status-reservado-border",
  },
  VENDIDO: {
    label: "VENDIDO",
    bgClass: "bg-status-vendido-bg",
    textClass: "text-status-vendido",
    borderClass: "border-status-vendido-border",
  },
  PROXIMAMENTE: {
    label: "PRÓXIMAMENTE",
    bgClass: "bg-status-proximamente-bg",
    textClass: "text-status-proximamente",
    borderClass: "border-status-proximamente-border",
  },
};

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full border text-label-sm font-label-sm tracking-wider uppercase font-bold ${config.bgClass} ${config.textClass} ${config.borderClass} ${className}`}
    >
      {config.label}
    </span>
  );
}

export default StatusBadge;
