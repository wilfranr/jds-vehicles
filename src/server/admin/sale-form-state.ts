export type SaleField = 'precio' | 'metodoPago' | 'observaciones' | 'confirmar';

export interface SaleFormState {
  fieldErrors: Partial<Record<SaleField, string>>;
  error?: string;
  /** Valores enviados para repoblar el formulario tras un error. */
  values: Partial<Record<'precio' | 'metodoPago' | 'observaciones' | 'confirmar', string>>;
}

export const initialSaleState: SaleFormState = { fieldErrors: {}, values: {} };
