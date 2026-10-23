'use server';

import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { siteContent } from '@/lib/site-content';
import { prisma } from '@/lib/db';
import { logAdminEvent } from '@/server/admin/audit';
import { generateTemporaryPassword } from '@/server/admin/temp-password';
import type { UserActionState } from '@/server/admin/user-form-state';
import {
  ROLE_NAMES,
  setUserActive,
  setUserPasswordHash,
  setUserRole,
  type UserChangeResult,
} from '@/server/admin/users';
import { requireAdmin } from '@/server/auth/staff';
import { BCRYPT_COST } from '@/server/auth/password';
import { checkAdminResetAllowed, recordAdminReset } from '@/server/security/limiters';

const copy = siteContent.adminUsers;

const targetId = z.number().int().min(1).max(4_294_967_295);
const roleSchema = z.enum(ROLE_NAMES as unknown as [string, ...string[]]);

/** Traduce los resultados de las salvaguardas a avisos claros (nunca revelan datos de otros registros). */
function failure(result: UserChangeResult): UserActionState | null {
  switch (result.status) {
    case 'self_forbidden':
      return { error: copy.errors.selfForbidden };
    case 'last_admin':
      return { error: copy.errors.lastAdmin };
    case 'not_found':
      return { error: copy.errors.generic };
    default:
      return null;
  }
}

/** El id del usuario afectado llega enlazado desde la fila de la tabla y se valida; el actor sale SIEMPRE de la sesión. */
export async function setActiveAction(
  rawTargetId: number,
  active: boolean,
  _previous: UserActionState,
  _formData: FormData
): Promise<UserActionState> {
  const actor = await requireAdmin('/admin/usuarios');
  const target = targetId.safeParse(rawTargetId);
  if (!target.success) return { error: copy.errors.generic };

  const result = await setUserActive(actor.id, target.data, active);
  const failed = failure(result);
  if (failed) return failed;
  if (result.status !== 'ok') return { error: copy.errors.generic };

  logAdminEvent({
    actorId: actor.id,
    action: active ? 'user_activated' : 'user_deactivated',
    entity: 'user',
    entityId: result.id,
  });
  revalidatePath('/admin/usuarios');
  if (active) return { success: copy.activated };
  return {
    success: copy.deactivated,
    ...(result.activeReservations > 0 ? { reservationsLinkEmail: await emailOf(result.id) } : {}),
  };
}

async function emailOf(id: number): Promise<string | undefined> {
  return (await prisma.user.findUnique({ where: { id }, select: { email: true } }))?.email;
}

export async function setRoleAction(
  rawTargetId: number,
  _previous: UserActionState,
  formData: FormData
): Promise<UserActionState> {
  const actor = await requireAdmin('/admin/usuarios');
  const target = targetId.safeParse(rawTargetId);
  // Del formulario solo se lee el rol, validado contra la lista cerrada.
  const rol = roleSchema.safeParse(formData.get('rol'));
  if (!target.success || !rol.success) return { error: copy.errors.generic };

  const result = await setUserRole(actor.id, target.data, rol.data as (typeof ROLE_NAMES)[number]);
  const failed = failure(result);
  if (failed) return failed;
  if (result.status !== 'ok') return { error: copy.errors.generic };

  logAdminEvent({
    actorId: actor.id,
    action: 'user_role_changed',
    entity: 'user',
    entityId: result.id,
    detail: `rol: ${rol.data}`,
  });
  revalidatePath('/admin/usuarios');
  return { success: copy.roleChanged };
}

export async function resetPasswordAction(
  rawTargetId: number,
  _previous: UserActionState,
  _formData: FormData
): Promise<UserActionState> {
  const actor = await requireAdmin('/admin/usuarios');
  const target = targetId.safeParse(rawTargetId);
  if (!target.success) return { error: copy.errors.generic };

  if (!checkAdminResetAllowed(actor.id).allowed) return { error: copy.errors.tooMany };
  recordAdminReset(actor.id);

  const temporary = generateTemporaryPassword();
  const result = await setUserPasswordHash(
    actor.id,
    target.data,
    await bcrypt.hash(temporary, BCRYPT_COST)
  );
  if (result.status === 'self_forbidden') return { error: copy.errors.selfForbidden };
  if (result.status !== 'ok') return { error: copy.errors.generic };

  // La contraseña no se registra en ningún log: solo quién y a quién.
  logAdminEvent({
    actorId: actor.id,
    action: 'user_password_reset',
    entity: 'user',
    entityId: result.id,
  });
  return { success: copy.tempPasswordTitle, tempPassword: temporary };
}
