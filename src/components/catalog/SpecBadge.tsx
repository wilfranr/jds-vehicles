import React from 'react';

interface SpecBadgeProps {
  label: string;
  value: string | number;
  highlight?: boolean;
}

export function SpecBadge({ label, value, highlight = false }: SpecBadgeProps) {
  return (
    <div
      className={`flex flex-col rounded-xl border p-3 transition-colors ${
        highlight
          ? 'bg-surface-container border-outline-variant/50'
          : 'bg-surface-container-low border-outline-variant/20'
      }`}
    >
      <span className="font-label-sm text-on-surface-variant text-[11px] font-medium tracking-wider uppercase">
        {label}
      </span>
      <span className="font-spec-numerical text-on-surface mt-0.5 truncate text-sm font-bold sm:text-base">
        {value}
      </span>
    </div>
  );
}
