import { notFound } from 'next/navigation';
import { StatusBadge, type VehicleStatus } from '@/components/ui/StatusBadge';
import { MessageCircle, Shield, Search, SlidersHorizontal, Sparkles } from 'lucide-react';

export default function DesignKitchenSinkPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  const statuses: VehicleStatus[] = ['NUEVO', 'USADO', 'RESERVADO', 'VENDIDO', 'PROXIMAMENTE'];

  return (
    <div className="px-gutter py-space-xl space-y-space-xl mx-auto max-w-7xl">
      <header className="border-surface-container-high pb-space-lg border-b">
        <div className="gap-space-sm mb-space-xs flex items-center">
          <Sparkles className="text-secondary h-6 w-6" />
          <h1 className="text-headline-xl font-headline-xl text-on-surface">
            Kitchen Sink: Sistema de Diseño Velocita Motors
          </h1>
        </div>
        <p className="text-body-lg font-body-lg text-on-surface-variant">
          Verificación visual de tokens de color, tipografía Plus Jakarta Sans, espaciados y
          componentes de estado.
        </p>
      </header>

      {/* 1. Status Badges */}
      <section className="bg-surface-container-lowest p-space-lg border-surface-container-high rounded-xl border shadow-sm">
        <h2 className="text-headline-md font-headline-md text-on-surface mb-space-md">
          1. Badges Semánticos de Estado (StatusBadge)
        </h2>
        <div className="gap-space-md flex flex-wrap items-center">
          {statuses.map((st) => (
            <div key={st} className="gap-space-xs flex flex-col items-center">
              <StatusBadge status={st} />
              <span className="text-label-sm font-label-sm text-on-surface-variant">{st}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 2. Color Palette */}
      <section className="bg-surface-container-lowest p-space-lg border-surface-container-high space-y-space-md rounded-xl border shadow-sm">
        <h2 className="text-headline-md font-headline-md text-on-surface">2. Paleta de Colores</h2>
        <div className="gap-space-sm grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
          <div className="p-space-md bg-primary text-on-primary rounded-lg">
            <span className="text-label-sm block font-bold">Primary</span>
            <span className="text-body-sm opacity-80">#000000</span>
          </div>
          <div className="p-space-md bg-secondary text-on-secondary rounded-lg">
            <span className="text-label-sm block font-bold">Secondary</span>
            <span className="text-body-sm opacity-80">#904d00</span>
          </div>
          <div className="p-space-md bg-secondary-container text-on-secondary-container rounded-lg">
            <span className="text-label-sm block font-bold">Secondary Cont.</span>
            <span className="text-body-sm opacity-80">#fe932c</span>
          </div>
          <div className="p-space-md bg-surface-container-low text-on-surface border-surface-container-high rounded-lg border">
            <span className="text-label-sm block font-bold">Surface Cont. Low</span>
            <span className="text-body-sm opacity-80">#eff4ff</span>
          </div>
          <div className="p-space-md bg-surface text-on-surface border-surface-container-high rounded-lg border">
            <span className="text-label-sm block font-bold">Surface</span>
            <span className="text-body-sm opacity-80">#f8f9ff</span>
          </div>
          <div className="p-space-md bg-whatsapp rounded-lg text-white">
            <span className="text-label-sm block font-bold">WhatsApp</span>
            <span className="text-body-sm opacity-80">#25D366</span>
          </div>
        </div>
      </section>

      {/* 3. Typography Scales */}
      <section className="bg-surface-container-lowest p-space-lg border-surface-container-high space-y-space-md rounded-xl border shadow-sm">
        <h2 className="text-headline-md font-headline-md text-on-surface">
          3. Escala Tipográfica (Plus Jakarta Sans)
        </h2>
        <div className="space-y-space-sm divide-surface-container-high divide-y">
          <div className="pt-space-xs">
            <span className="text-label-sm text-on-surface-variant block">
              display-hero (56px, 800)
            </span>
            <p className="text-display-hero font-display-hero text-on-surface">Showroom Digital</p>
          </div>
          <div className="pt-space-xs">
            <span className="text-label-sm text-on-surface-variant block">
              headline-xl (40px, 700)
            </span>
            <p className="text-headline-xl font-headline-xl text-on-surface">
              Encuentra tu próximo auto
            </p>
          </div>
          <div className="pt-space-xs">
            <span className="text-label-sm text-on-surface-variant block">
              headline-lg (28px, 700)
            </span>
            <p className="text-headline-lg font-headline-lg text-on-surface">
              Vehículos Certificados
            </p>
          </div>
          <div className="pt-space-xs">
            <span className="text-label-sm text-on-surface-variant block">
              headline-md (22px, 600)
            </span>
            <p className="text-headline-md font-headline-md text-on-surface">
              Audi RS6 Avant Quattro
            </p>
          </div>
          <div className="pt-space-xs">
            <span className="text-label-sm text-on-surface-variant block">
              headline-sm (18px, 600)
            </span>
            <p className="text-headline-sm font-headline-sm text-on-surface">
              Garantía Pericial 120 Puntos
            </p>
          </div>
          <div className="pt-space-xs">
            <span className="text-label-sm text-on-surface-variant block">body-lg (16px, 400)</span>
            <p className="text-body-lg font-body-lg text-on-surface-variant">
              Inspección pericial de 120 puntos, historial verificado y entrega inmediata.
            </p>
          </div>
          <div className="pt-space-xs">
            <span className="text-label-sm text-on-surface-variant block">body-md (14px, 400)</span>
            <p className="text-body-md font-body-md text-on-surface">
              Texto base corporativo utilizado en descripciones y fichas técnicas.
            </p>
          </div>
          <div className="pt-space-xs">
            <span className="text-label-sm text-on-surface-variant block">
              spec-numerical (15px, 700)
            </span>
            <p className="text-spec-numerical font-spec-numerical text-secondary">
              $ 185.000.000 COP
            </p>
          </div>
        </div>
      </section>

      {/* 4. Action and Icon Showcase */}
      <section className="bg-surface-container-lowest p-space-lg border-surface-container-high space-y-space-md rounded-xl border shadow-sm">
        <h2 className="text-headline-md font-headline-md text-on-surface">
          4. Integración de Iconos Lucide & Botones
        </h2>
        <div className="gap-space-md flex flex-wrap items-center">
          <button className="gap-space-xs px-space-lg py-space-sm bg-primary text-on-primary font-label-lg text-label-lg hover:bg-inverse-surface flex items-center rounded-lg transition-colors">
            <SlidersHorizontal className="h-4 w-4" />
            <span>Explorar Inventario</span>
          </button>
          <button className="gap-space-xs px-space-lg py-space-sm bg-whatsapp font-label-lg text-label-lg flex items-center rounded-lg text-white transition-opacity hover:opacity-90">
            <MessageCircle className="h-4 w-4" />
            <span>Contactar Concierge</span>
          </button>
          <div className="gap-space-xs px-space-md py-space-xs bg-surface-container-low text-on-surface-variant border-surface-container-high flex items-center rounded-lg border">
            <Search className="h-4 w-4" />
            <span className="text-body-sm font-body-sm">Buscar vehículos...</span>
          </div>
          <div className="gap-space-xs text-on-surface flex items-center">
            <Shield className="text-secondary h-5 w-5" />
            <span className="text-label-md font-label-md">100% Verificado</span>
          </div>
        </div>
      </section>
    </div>
  );
}
