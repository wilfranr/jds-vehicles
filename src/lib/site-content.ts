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
  // Contenido de /proximamente
  proximamente: {
    title: 'Próximamente Disponibles | JDS Vehículos',
    heading: 'Próximamente en Inventario',
    subtitle:
      'Vehículos en alistamiento, peritaje o transporte previo a su ingreso al catálogo oficial.',
    emptyTitle: 'Pronto tendremos novedades en alistamiento',
    emptyDescription:
      'Actualmente no hay vehículos en preparación. Escríbenos por WhatsApp y te avisaremos tan pronto ingrese una unidad de tu interés.',
    emptyCtaText: 'Consultar por WhatsApp',
    emptyWhatsAppMessage:
      'Hola JDS Vehículos, me gustaría saber qué próximos vehículos ingresarán al inventario.',
  },
  // Contenido de /como-funciona
  comoFunciona: {
    title: 'Cómo Funciona | JDS Vehículos',
    heading: 'Cómo Comprar en JDS Vehículos',
    subtitle:
      'Un proceso transparente, ágil y seguro diseñado para que adquieras tu próximo vehículo con total confianza.',
    steps: [
      {
        number: '01',
        title: 'Explora y Elige',
        description:
          'Recorre nuestro catálogo digital con fotos reales, especificaciones detalladas y precio de contado sin sorpresas.',
      },
      {
        number: '02',
        title: 'Crea tu Cuenta o Inicia Sesión',
        description:
          'Regístrate de forma rápida con tus datos básicos para poder apartar y gestionar el seguimiento de tu vehículo.',
      },
      {
        number: '03',
        title: 'Aparta tu Vehículo',
        description:
          'Reserva en línea: el vehículo queda apartado temporalmente y generas un código de reserva único para tu solicitud.',
      },
      {
        number: '04',
        title: 'Continúa por WhatsApp',
        description:
          'Un asesor comercial de JDS te contactará directamente vía WhatsApp con el código de reserva para coordinar detalles y peritaje presencial.',
      },
      {
        number: '05',
        title: 'Cierre y Traspaso Seguro',
        description:
          'El pago, trámites legales y traspaso se coordinan de forma presencial y segura directamente con el concesionario.',
      },
    ],
    faqs: [
      {
        question: '¿Qué significa reservar un vehículo en la plataforma?',
        answer:
          'Al reservar, el vehículo pasa a estado "Reservado" en el catálogo, lo que indica a otros compradores que está apartado mientras coordinas los siguientes pasos con nuestro asesor.',
      },
      {
        question: '¿Cuánto tiempo dura la reserva de un vehículo?',
        // TODO(owner): confirmar vigencia exacta de la reserva en horas o días antes de producción
        answer:
          'La reserva aparta el vehículo durante el plazo fijado por el concesionario para que nuestro equipo comercial te contacte y avance en el trámite.',
      },
      {
        question: '¿Tiene algún costo reservar en la plataforma web?',
        // TODO(owner): confirmar política de cobro/anticipo de reserva antes de producción
        answer:
          'En la plataforma web generas tu solicitud y código de reserva. Los acuerdos comerciales o anticipos se coordinan de manera directa y personalizada con el concesionario.',
      },
      {
        question: '¿Qué ocurre si decido no continuar con la compra?',
        answer:
          'Puedes notificar a tu asesor por WhatsApp en cualquier momento. El vehículo volverá a estar disponible en el catálogo para otros clientes.',
      },
    ],
    ctaTitle: '¿Listo para encontrar tu próximo vehículo?',
    ctaSubtitle:
      'Explora las opciones disponibles hoy mismo y contáctanos si tienes alguna inquietud.',
    ctaButton: 'Explorar Catálogo',
  },
  // Contenido de /contacto
  contacto: {
    title: 'Contacto | JDS Vehículos',
    heading: 'Canales de Atención Directa',
    subtitle:
      'Estamos listos para asesorarte en la compra o venta de tu vehículo a través de nuestros canales oficiales.',
    whatsappTitle: 'Atención por WhatsApp',
    whatsappDescription:
      'Nuestra vía principal de comunicación comercial. Te atendemos de manera personalizada para consultas de inventario, reservas y citas.',
    whatsappButtonText: 'Escribir a un asesor',
    instagramTitle: 'Síguenos en Instagram',
    instagramDescription:
      'Entérate antes que nadie de los nuevos ingresos, fotos exclusivas y entregas en nuestro canal de Instagram.',
    instagramButtonText: 'Ver perfil oficial',
    // TODO(owner): agregar datos de dirección física, horario de atención y mapa embebido una vez suministrados por el concesionario.
  },
} as const;
