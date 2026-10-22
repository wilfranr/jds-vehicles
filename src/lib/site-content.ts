/**
 * Centralización de textos, eslóganes y cifras de marca provisionales del concesionario.
 * Modificar estos valores permite actualizar el contenido editorial sin alterar componentes.
 */

// TODO(owner): cifras y afirmaciones provisionales, confirmar con el negocio antes del lanzamiento en producción (Fase 6).
export const trustMetrics = [
  { value: '42', label: 'Vehículos Curados' },
  { value: '100%', label: 'Garantía Mecánica' },
  { value: '48h', label: 'Entrega Inmediata' },
] as const;

export const siteContent = {
  businessName: 'JDS Vehículos',
  shortDescription: 'Concesionario de vehículos nuevos y seminuevos.',
  // TODO(owner): afirmaciones de certificación y métricas provisionales del prototipo, confirmar con el negocio
  heroTag: 'Showroom Certificado JDS Vehículos',
  heroTitle: 'Encuentra tu próximo auto nuevo o seminuevo certificado',
  heroSubtitle:
    'Inspección pericial de 120 puntos, historial de propiedad verificado y entrega de llave en mano garantizada.',
  catalogTitle: 'Catálogo / Inventario',
  catalogSubtitle: 'Explora nuestro inventario de vehículos nuevos y seminuevos.',
  featuredSectionTitle: 'Vehículos Disponibles Recientes',
  featuredSectionSubtitle: 'Explora los vehículos disponibles para entrega inmediata.',
  defaultWhatsAppMessage:
    'Hola JDS Vehículos, quisiera recibir asesoría personalizada sobre su inventario.',
  navLinks: [
    { label: 'Catálogo / Inventario', href: '/catalogo' },
    { label: 'Próximamente Disponibles', href: '/proximamente' },
    { label: 'Cómo Funciona', href: '/como-funciona' },
    { label: 'Contacto', href: '/contacto' },
  ],
  // TODO(owner): reponer enlaces legales cuando existan las páginas correspondientes (/terminos-condiciones, /privacidad, /certificacion)
  footerLinks: [] as const as { label: string; href: string }[],
  defaultFallbackSocials: {
    whatsappNumber: '573202353168',
    whatsappDisplay: '+57 320 235 3168',
    instagramUrl:
      'https://www.instagram.com/jds_77vehiculos?xtok=MW16OThrNW1iY3Nxbg%3D%3D&utm_source=qr',
    instagramHandle: '@jds_77vehiculos',
  },
  // Contenido de la página de detalle de vehículo (/vehiculos/[id])
  vehicleDetail: {
    backToCatalog: 'Volver al catálogo',
    breadcrumbHome: 'Inicio',
    breadcrumbCatalog: 'Catálogo',
    descriptionHeading: 'Descripción del Vehículo',
    noDescription: 'Sin descripción adicional registrada para esta unidad.',
    priceLabel: 'Precio de contado',
    similarHeading: 'Vehículos Similares',
    similarSubtitle: 'Otras opciones de la misma marca o en un rango de precio semejante.',
    viewAllCatalog: 'Ver catálogo completo',
    reserveAvailableCta: 'Consultar disponibilidad por WhatsApp',
    writeWhatsAppCta: 'Escribir por WhatsApp',
    reservedTitle: 'Este vehículo se encuentra reservado',
    reservedDescription:
      'Un cliente ha apartado esta unidad. Puedes escribirnos para recibir asesoría sobre vehículos similares o ser notificado si se libera.',
    reservedCta: 'Consultar alternativas por WhatsApp',
    preorderTitle: 'Vehículo en preparación (Preventa)',
    preorderDescription:
      'Esta unidad está completando su proceso de alistamiento y peritaje pericial.',
    preorderCta: 'Preguntar por este vehículo',
    // TODO(owner): bloque de inspección/certificación o peritaje por unidad pendiente de definición y aprobación comercial oficial
  },
} as const;
