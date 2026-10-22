/**
 * Centralización de textos, eslóganes y cifras de marca provisionales del concesionario.
 * Modificar estos valores permite actualizar el contenido editorial sin alterar componentes.
 */

// TODO(owner): cifras provisionales, confirmar con el negocio antes del lanzamiento en producción (Fase 6).
export const trustMetrics = [
  { value: '42', label: 'Vehículos Curados' },
  { value: '100%', label: 'Garantía Mecánica' },
  { value: '48h', label: 'Entrega Inmediata' },
] as const;

export const siteContent = {
  businessName: 'JDS Vehículos',
  shortDescription:
    'Excelencia automotriz y exclusividad digital para compradores y coleccionistas exigentes.',
  platformBadge: 'Plataforma Digital Certificada',
  legalName: 'JDS Vehículos S.A. de C.V.',
  heroTag: 'Showroom Certificado JDS Vehículos 2025',
  heroTitle: 'Encuentra tu próximo auto nuevo o seminuevo certificado',
  heroSubtitle:
    'Inspección pericial de 120 puntos, historial de propiedad verificado y entrega de llave en mano garantizada.',
  defaultWhatsAppMessage:
    'Hola JDS Vehículos, quisiera recibir asesoría personalizada sobre su inventario.',
  navLinks: [
    { label: 'Catálogo / Inventario', href: '/catalogo' },
    { label: 'Próximamente Disponibles', href: '/proximamente' },
    { label: 'Cómo Funciona', href: '/como-funciona' },
    { label: 'Contacto', href: '/contacto' },
  ],
  footerLinks: [
    { label: 'Términos del Servicio', href: '/terminos-condiciones' },
    { label: 'Aviso de Privacidad', href: '/privacidad' },
    {
      label: 'Certificación 120 Puntos JDS Vehículos',
      href: '/certificacion',
    },
  ],
  defaultFallbackSocials: {
    whatsappNumber: '573202353168',
    whatsappDisplay: '+57 320 235 3168',
    instagramUrl:
      'https://www.instagram.com/jds_77vehiculos?xtok=MW16OThrNW1iY3Nxbg%3D%3D&utm_source=qr',
    instagramHandle: '@jds_77vehiculos',
  },
} as const;
