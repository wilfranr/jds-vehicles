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
  catalogMetaTitle: 'Catálogo de Vehículos',
  catalogResultsHeading: 'Resultados del catálogo',
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
  // Metadatos globales y de la portada (SEO)
  seo: {
    titleTemplate: '%s | JDS Vehículos',
    defaultTitle: 'JDS Vehículos',
    // TODO(owner): título y descripción de la portada usan las afirmaciones provisionales del prototipo (120 puntos, entrega garantizada)
    homeTitle: 'JDS Vehículos | Autos Nuevos y Seminuevos Certificados',
    homeDescription:
      'Encuentra tu próximo auto nuevo o seminuevo certificado en JDS Vehículos. Inspección pericial de 120 puntos y entrega garantizada.',
    siteDescription: 'Concesionario de vehículos nuevos y seminuevos.',
    locale: 'es_CO',
    notFoundVehicleTitle: 'Vehículo no encontrado',
  },
  // Autenticación (mensajes genéricos: no distinguen correo inexistente, contraseña errónea ni usuario inactivo)
  auth: {
    invalidCredentials: 'Correo o contraseña incorrectos.',
  },
  // Contenido de /registro
  registro: {
    title: 'Crear cuenta',
    heading: 'Crear cuenta',
    subtitle: 'Regístrate para poder reservar vehículos y hacer seguimiento a tus solicitudes.',
    submit: 'Crear cuenta',
    submitting: 'Creando cuenta…',
    haveAccount: '¿Ya tienes cuenta?',
    loginLink: 'Inicia sesión',
    optionalSuffix: '(opcional)',
    sections: { personal: 'Datos personales', account: 'Datos de acceso', location: 'Ubicación' },
    labels: {
      nombre: 'Nombres',
      apellido: 'Apellidos',
      tipoDocumento: 'Tipo de documento',
      documento: 'Número de documento',
      email: 'Correo electrónico',
      telefono: 'Celular',
      password: 'Contraseña',
      confirmPassword: 'Confirmar contraseña',
      ciudad: 'Ciudad',
      direccion: 'Dirección',
    },
    hints: {
      documento: 'Sin puntos, espacios ni guiones.',
      telefono: 'Celular colombiano de 10 dígitos; se usa para contactarte por WhatsApp.',
      password: 'Entre 10 y 72 caracteres, con al menos una letra y un número.',
    },
    documentTypes: [
      { value: 'CC', label: 'Cédula de ciudadanía' },
      { value: 'CE', label: 'Cédula de extranjería' },
      { value: 'NIT', label: 'NIT' },
      { value: 'PASAPORTE', label: 'Pasaporte' },
    ],
    // TODO(owner): texto legal definitivo del tratamiento de datos personales (Ley 1581 de 2012, confirmar con asesoría legal)
    // y enlace a /privacidad cuando exista la página.
    consentimiento: 'Autorizo el tratamiento de mis datos personales.',
    errorSummary: 'Revisa los campos marcados.',
    errors: {
      nombre: 'Ingresa tus nombres (entre 2 y 100 caracteres).',
      apellido: 'Ingresa tus apellidos (entre 2 y 100 caracteres).',
      tipoDocumento: 'Selecciona un tipo de documento.',
      documento: 'Ingresa un documento de 5 a 30 caracteres, solo letras y números.',
      email: 'Ingresa un correo electrónico válido.',
      telefono: 'Ingresa un celular colombiano de 10 dígitos que empiece por 3.',
      passwordLength: 'La contraseña debe tener entre 10 y 72 caracteres.',
      passwordComposition: 'La contraseña debe incluir al menos una letra y un número.',
      passwordCommon: 'Esa contraseña es demasiado común. Elige otra.',
      passwordMismatch: 'Las contraseñas no coinciden.',
      ciudad: 'La ciudad no puede superar 100 caracteres.',
      direccion: 'La dirección no puede superar 255 caracteres.',
      consentimiento: 'Debes autorizar el tratamiento de tus datos para crear la cuenta.',
      duplicate: 'No fue posible completar el registro con esos datos.',
      config: 'No fue posible completar el registro en este momento. Inténtalo más tarde.',
    },
  },
  // Páginas de error globales
  errorPages: {
    notFoundTitle: 'Página no encontrada',
    notFoundDescription: 'La página que buscas no existe o cambió de dirección.',
    errorTitle: 'Algo salió mal',
    errorDescription:
      'Ocurrió un problema inesperado al cargar esta página. Puedes intentarlo de nuevo o escribirnos por WhatsApp.',
    retryCta: 'Reintentar',
    catalogCta: 'Ver el catálogo',
    homeCta: 'Ir al inicio',
    whatsappCta: 'Escribir por WhatsApp',
    whatsappMessage: 'Hola JDS Vehículos, tuve un problema al usar el sitio web.',
  },
  // Contenido de /proximamente
  proximamente: {
    title: 'Próximamente Disponibles',
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
    title: 'Cómo Funciona',
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
    title: 'Contacto',
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
      'Un cliente ha apartado esta unidad. Puedes escribirnos para consultar por otras opciones disponibles.',
    reservedCta: 'Consultar alternativas por WhatsApp',
    preorderTitle: 'Próxima llegada (Preventa)',
    preorderDescription:
      'Esta unidad está por ingresar a nuestro inventario. Escríbenos para recibir más información.',
    preorderCta: 'Preguntar por este vehículo',
    // TODO(owner): bloque de inspección/certificación o peritaje por unidad pendiente de definición y aprobación comercial oficial
  },
} as const;
