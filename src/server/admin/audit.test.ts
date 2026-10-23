import { describe, it, expect, vi, afterEach } from 'vitest';
import { logAdminEvent } from './audit';

afterEach(() => vi.restoreAllMocks());

function logged(): Record<string, unknown> {
  const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
  logAdminEvent({
    actorId: 3,
    action: 'reservation.status_changed',
    entity: 'reservation',
    entityId: 12,
    detail: 'PENDIENTE_CONTACTO→EN_NEGOCIACION',
  });
  return JSON.parse(spy.mock.calls[0]![0] as string);
}

describe('logAdminEvent', () => {
  it('escribe una línea JSON del canal admin con quién, qué y el id afectado', () => {
    expect(logged()).toMatchObject({
      channel: 'admin',
      actorId: 3,
      action: 'reservation.status_changed',
      entity: 'reservation',
      entityId: 12,
      detail: 'PENDIENTE_CONTACTO→EN_NEGOCIACION',
    });
  });

  it('es una sola línea y solo contiene los campos esperados', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    logAdminEvent({ actorId: 1, action: 'a.b', entity: 'x' });
    const raw = spy.mock.calls[0]![0] as string;
    expect(raw).not.toContain('\n');
    expect(Object.keys(JSON.parse(raw)).sort()).toEqual([
      'action',
      'actorId',
      'channel',
      'entity',
      'level',
      'ts',
    ]);
  });

  it('acota el detalle a 200 caracteres', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    logAdminEvent({ actorId: 1, action: 'a.b', entity: 'x', detail: 'z'.repeat(500) });
    expect(JSON.parse(spy.mock.calls[0]![0] as string).detail).toHaveLength(200);
  });
});
