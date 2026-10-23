import { logEvent } from '@/server/log';

/** Un cambio relevante hecho desde el panel. Solo ids y nombres de acción: sin datos personales ni secretos. */
export interface AdminEvent {
  /** Id del usuario del panel que hizo el cambio (siempre de la sesión). */
  actorId: number;
  /** Acción en minúsculas con punto, p. ej. `reservation.status_changed`. */
  action: string;
  /** Entidad afectada, p. ej. `reservation`, `vehicle`, `user`. */
  entity: string;
  entityId?: number;
  /** Contexto no sensible (p. ej. «PENDIENTE_CONTACTO→EN_NEGOCIACION»). */
  detail?: string;
}

const MAX_DETAIL = 200;

/** Línea JSON en stdout, canal `admin`. La usan todos los issues de la Fase 4. */
export function logAdminEvent(event: AdminEvent): void {
  logEvent({
    channel: 'admin',
    actorId: event.actorId,
    action: event.action,
    entity: event.entity,
    ...(event.entityId !== undefined ? { entityId: event.entityId } : {}),
    ...(event.detail ? { detail: event.detail.slice(0, MAX_DETAIL) } : {}),
  });
}
