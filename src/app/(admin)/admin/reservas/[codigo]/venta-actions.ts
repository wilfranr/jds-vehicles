'use server';

import { redirect } from 'next/navigation';
import { siteContent } from '@/lib/site-content';
import { createSaleSchema } from '@/lib/validation/sale';
import { logAdminEvent } from '@/server/admin/audit';
import { registerSale } from '@/server/admin/sales';
import type { SaleField, SaleFormState } from '@/server/admin/sale-form-state';
import { requireStaff } from '@/server/auth/staff';
import { invalidateCatalogFromAction } from '@/server/reservations';
import { parseReservationCode } from '@/server/reservations/code';

const copy = siteContent.adminSales;
const schema = createSaleSchema({
  price: copy.errors.price,
  method: copy.errors.method,
  notes: copy.errors.notes,
  confirm: copy.errors.confirm,
});

/**
 * Registra la venta de una reserva. El código llega enlazado desde la página y se revalida; del formulario solo
 * se leen `precio`, `metodoPago`, `observaciones` y `confirmar`. El comprador sale de la reserva y el vendedor de
 * la sesión (`requireStaff()`): cualquier `compradorId`/`vendedorId` enviado se ignora.
 */
export async function registerSaleAction(
  rawCode: string,
  _previous: SaleFormState,
  formData: FormData
): Promise<SaleFormState> {
  const code = parseReservationCode(rawCode);
  if (!code) return { fieldErrors: {}, error: copy.errors.notFound, values: {} };
  const seller = await requireStaff(`/admin/reservas/${code}`);

  const text = (name: string) => {
    const value = formData.get(name);
    return typeof value === 'string' ? value : undefined;
  };
  const values = {
    precio: text('precio')?.slice(0, 40) ?? '',
    metodoPago: text('metodoPago')?.slice(0, 20) ?? '',
    observaciones: text('observaciones')?.slice(0, 1200) ?? '',
    // La casilla se conserva tras un error de otro campo (React reinicia el formulario al terminar la acción).
    confirmar: text('confirmar') === 'on' ? 'on' : '',
  };

  const parsed = schema.safeParse({
    precio: text('precio'),
    metodoPago: text('metodoPago'),
    observaciones: text('observaciones') ?? '',
    confirmar: text('confirmar'),
  });
  if (!parsed.success) {
    const fieldErrors: SaleFormState['fieldErrors'] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as SaleField | undefined;
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { fieldErrors, values };
  }

  const result = await registerSale({
    reservationCode: code,
    sellerId: seller.id,
    sale: parsed.data,
  });
  switch (result.status) {
    case 'not_found':
      return { fieldErrors: {}, error: copy.errors.notFound, values };
    case 'invalid_state':
      return { fieldErrors: {}, error: copy.errors.invalidState, values };
    case 'vehicle_invalid':
      return { fieldErrors: {}, error: copy.errors.vehicleInvalid, values };
    case 'ok':
      break;
  }

  // Datos del negocio (no personales): recibo y precio final; nunca el comprador.
  logAdminEvent({
    actorId: seller.id,
    action: 'sale.registered',
    entity: 'sale',
    entityId: result.id,
    detail: `${result.receipt}; precio ${parsed.data.precio}; método ${parsed.data.metodoPago}`,
  });
  // El vehículo sale del catálogo y de su ficha pública.
  invalidateCatalogFromAction();
  redirect(`/admin/ventas/${result.receipt}`);
}
