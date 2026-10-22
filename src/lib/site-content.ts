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
    subtitle: 'Vehículos que están por ingresar a nuestro inventario.',
    emptyTitle: 'Pronto tendremos novedades en inventario',
    emptyDescription:
      'Actualmente no hay vehículos por ingresar. Escríbenos por WhatsApp y te avisaremos tan pronto ingrese una unidad de tu interés.',
    emptyCtaText: 'Consultar por WhatsApp',
    emptyWhatsAppMessage:
      'Hola JDS Vehículos, me gustaría saber qué próximos vehículos ingresarán al inventario.',
  },
  // Contenido de /como-funciona
  comoFunciona: {
    title: 'Cómo Funciona | JDS Vehículos',
    heading: 'Cómo Comprar en JDS Vehículos',
    subtitle: 'Así reservas tu vehículo en JDS Vehículos, paso a paso.',
    steps: [
      {
        number: '01',
        title: 'Explora y Elige',
        description:
          'Recorre nuestro catálogo digital con las especificaciones y precio de cada vehículo.',
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
          'Reserva en línea: el vehículo queda apartado temporalmente y recibes un código único para tu solicitud.',
      },
      {
        number: '04',
        title: 'Continúa por WhatsApp',
        description:
          'Se abre la conversación de WhatsApp con un asesor comercial llevando el código de reserva en el mensaje.',
      },
      {
        number: '05',
        title: 'Cierre del Negocio',
        description:
          'El pago, trámites y traspaso se coordinan directamente con el concesionario, fuera de la plataforma.',
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
        // TODO(owner): confirmar política comercial de reserva antes de producción
        answer: 'Los detalles del proceso comercial los confirma tu asesor por WhatsApp.',
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
      'Estamos listos para asesorarte en la compra de tu vehículo a través de nuestros canales oficiales.',
    whatsappTitle: 'Atención por WhatsApp',
    whatsappDescription:
      'Nuestra vía principal de comunicación comercial. Te atendemos de manera personalizada para consultas de inventario y reservas.',
    whatsappButtonText: 'Escribir a un asesor',
    instagramTitle: 'Síguenos en Instagram',
    instagramDescription: 'Síguenos en Instagram para ver novedades.',
    instagramButtonText: 'Ver perfil oficial',
    // TODO(owner): agregar datos de dirección física, horario de atención y mapa embebido una vez suministrados por el concesionario.
  },
} as const;
