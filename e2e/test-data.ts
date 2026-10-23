import path from 'node:path';

/** Marcas de los datos temporales de las pruebas e2e: permiten barrerlos aunque una ejecución se interrumpa. */
export const E2E_EMAIL_DOMAIN = '@e2e-test.local';
export const E2E_VEHICLE_COLOR_PREFIX = 'E2E-RESERVAS-';
/** Marcas (y sus modelos) creadas por las pruebas del panel. */
export const E2E_BRAND_PREFIX = 'E2E-MARCA-';

/**
 * Carpeta de subidas del servidor de e2e (`UPLOADS_DIR` en `playwright.config.ts`). Las pruebas de fotos borran
 * sus archivos y `global-setup.ts` comprueba que no queden residuos.
 */
export const E2E_UPLOADS_DIR = path.resolve('.e2e-uploads');
