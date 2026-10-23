export interface UserActionState {
  error?: string;
  success?: string;
  /** Se muestra una sola vez; vive solo en el estado del componente (nunca en la URL, el registro ni la BD en claro). */
  tempPassword?: string;
  /** Correo del usuario afectado, para enlazar a sus reservas activas. */
  reservationsLinkEmail?: string;
}

export const initialUserActionState: UserActionState = {};
