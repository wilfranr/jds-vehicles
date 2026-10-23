// Contenido legal (F5-04). Lo aporta el PROPIETARIO, con asesoría legal (Ley 1581 de 2012): aquí no se inventa nada.
// Mientras un documento sea `null`, esté incompleto o contenga el marcador de pendiente, su página responde 404 y
// no se enlaza en ninguna parte (ver `src/lib/legal.ts`).
//
// TODO(owner): aportar la política de tratamiento de datos personales y los términos del servicio.

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

export const legalContent: LegalContent = {
  privacidad: null,
  terminos: null,
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
