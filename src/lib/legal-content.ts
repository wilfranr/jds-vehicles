// Contenido legal (F5-04). Lo aporta el PROPIETARIO, con asesoría legal (Ley 1581 de 2012): aquí no se inventa nada.
// Mientras un documento sea `null`, esté incompleto o contenga el marcador de pendiente, su página responde 404 y
// no se enlaza en ninguna parte (ver `src/lib/legal.ts`).
//

export interface LegalSection {
  heading: string;
  paragraphs: readonly string[];
  items?: readonly string[];
}

export interface LegalDocument {
  title: string;
  /** Fecha de entrada en vigencia (AAAA-MM-DD). */
  effectiveDate: string;
  /** Fecha de la última actualización (AAAA-MM-DD). */
  updatedAt: string;
  /** Razón social e identificación del responsable del tratamiento. */
  responsible: string;
  sections: readonly LegalSection[];
}

export type LegalKind = 'privacidad' | 'terminos';

export type LegalContent = Record<LegalKind, LegalDocument | null>;

// Texto de la demostración basado en la Ley 1581 de 2012 y el Decreto 1377 de 2013; debe ser revisado por la
// asesoría legal del concesionario antes de operar con clientes reales.
export const legalContent: LegalContent = {
  privacidad: {
    title: 'Autorización para el tratamiento de datos personales',
    effectiveDate: '2026-10-24',
    updatedAt: '2026-10-24',
    responsible: 'JDS Vehículos',
    sections: [
      {
        heading: 'Responsable del tratamiento',
        paragraphs: [
          'JDS Vehículos es el responsable del tratamiento de los datos personales que recibe a través de este sitio, de acuerdo con la Ley 1581 de 2012, el Decreto 1377 de 2013 y las demás normas que las modifiquen o complementen.',
        ],
      },
      {
        heading: 'Datos que recolectamos',
        paragraphs: ['Al crear tu cuenta y reservar un vehículo podemos recolectar:'],
        items: [
          'Nombres y apellidos.',
          'Tipo y número de documento de identidad.',
          'Correo electrónico y número de celular.',
          'Ciudad y dirección (opcionales).',
          'Los vehículos que reservas y el estado de tus reservas.',
        ],
      },
      {
        heading: 'Finalidades del tratamiento',
        paragraphs: ['Usamos tus datos únicamente para:'],
        items: [
          'Crear y administrar tu cuenta en el sitio.',
          'Registrar tus reservas y permitir que un asesor te contacte, por WhatsApp o por teléfono, para continuar el proceso.',
          'Gestionar la negociación y el registro de la venta del vehículo.',
          'Atender tus consultas, solicitudes y reclamos.',
          'Cumplir obligaciones legales y contractuales.',
        ],
      },
      {
        heading: 'Autorización',
        paragraphs: [
          'Al marcar la casilla de autorización al registrarte, declaras que has leído esta política y autorizas de manera libre, previa, expresa e informada a JDS Vehículos para tratar tus datos personales según las finalidades descritas.',
          'Esta autorización es voluntaria. Si no la otorgas no podremos crear tu cuenta ni registrar reservas, pero podrás seguir consultando el catálogo.',
        ],
      },
      {
        heading: 'Tus derechos como titular',
        paragraphs: ['De acuerdo con la Ley 1581 de 2012, tienes derecho a:'],
        items: [
          'Conocer, actualizar y rectificar tus datos personales.',
          'Solicitar prueba de la autorización otorgada.',
          'Ser informado sobre el uso que se ha dado a tus datos.',
          'Presentar quejas ante la Superintendencia de Industria y Comercio por infracciones a la ley.',
          'Revocar la autorización y solicitar la supresión de tus datos, cuando no exista un deber legal o contractual de conservarlos.',
          'Acceder de forma gratuita a tus datos personales.',
        ],
      },
      {
        heading: 'Seguridad y conservación',
        paragraphs: [
          'Protegemos tus datos con medidas técnicas y administrativas: las contraseñas se almacenan cifradas, el acceso del personal depende de su rol y el documento de identidad se muestra enmascarado en el panel. Conservamos tus datos mientras mantengas tu cuenta o sea necesario para cumplir obligaciones legales.',
          'No vendemos tus datos personales ni los compartimos con terceros para publicidad.',
        ],
      },
      {
        heading: 'Cambios a esta política',
        paragraphs: [
          'Si modificamos esta política publicaremos la nueva versión en esta página, con su fecha de actualización.',
        ],
      },
    ],
  },
  terminos: {
    title: 'Términos y condiciones del servicio',
    effectiveDate: '2026-10-24',
    updatedAt: '2026-10-24',
    responsible: 'JDS Vehículos',
    sections: [
      {
        heading: 'Objeto',
        paragraphs: [
          'Estos términos regulan el uso del sitio de JDS Vehículos, donde puedes consultar el catálogo de vehículos y reservar una unidad disponible. Al crear una cuenta o reservar aceptas estas condiciones.',
        ],
      },
      {
        heading: 'Cuenta de usuario',
        paragraphs: [
          'Debes entregar datos verdaderos y mantener tu contraseña en reserva. Eres responsable de la actividad realizada con tu cuenta.',
        ],
      },
      {
        heading: 'Reservas',
        paragraphs: ['Al reservar un vehículo:'],
        items: [
          'El vehículo queda apartado para ti y deja de estar disponible para otras personas.',
          'Recibes un código de reserva y continúas la conversación con un asesor por WhatsApp.',
          'La reserva se mantiene por un tiempo limitado; si el asesor no logra concretar el proceso, puede cancelarse o vencer y el vehículo vuelve a estar disponible.',
          'Puedes tener un máximo de dos reservas activas al mismo tiempo.',
          'La reserva no es una compraventa: el pago, los documentos y la entrega se acuerdan directamente con el asesor, fuera de la plataforma.',
        ],
      },
      {
        heading: 'Información de los vehículos',
        paragraphs: [
          'Hacemos lo posible por mantener actualizados los precios, las fotos y las características. Pueden existir diferencias; el precio y las condiciones finales son los que confirme el asesor al cerrar el negocio.',
        ],
      },
      {
        heading: 'Uso adecuado',
        paragraphs: [
          'No puedes usar el sitio para fines ilícitos, intentar acceder sin autorización a áreas restringidas ni hacer reservas sin intención de compra.',
        ],
      },
      {
        heading: 'Datos personales',
        paragraphs: [
          'El tratamiento de tus datos personales se rige por la autorización y política de tratamiento de datos personales publicada en este sitio.',
        ],
      },
      {
        heading: 'Modificaciones',
        paragraphs: [
          'Podemos actualizar estos términos; la versión vigente es la publicada en esta página.',
        ],
      },
    ],
  },
};

export interface EssentialCookie {
  /** Nombre sin prefijo; en HTTPS Auth.js añade `__Secure-` o `__Host-`. */
  name: string;
  purpose: string;
  duration: string;
}

/**
 * Cookies que usa la aplicación (todas estrictamente necesarias, por eso no hay banner de consentimiento).
 * Un e2e (`e2e/cookies.spec.ts`) falla si el sitio establece alguna que no esté en esta lista.
 */
export const essentialCookies: readonly EssentialCookie[] = [
  {
    name: 'authjs.session-token',
    purpose: 'Mantiene tu sesión iniciada.',
    duration: '7 días o hasta cerrar sesión',
  },
  {
    name: 'authjs.csrf-token',
    purpose: 'Protege los formularios de inicio de sesión contra envíos desde otros sitios.',
    duration: 'Sesión del navegador',
  },
  {
    name: 'authjs.callback-url',
    purpose: 'Recuerda a qué página volver después de iniciar sesión.',
    duration: 'Sesión del navegador',
  },
];
