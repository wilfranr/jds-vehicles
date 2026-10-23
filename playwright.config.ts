import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.E2E_PORT ?? 3100);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${port}`;

// Requiere `pnpm build` previo y la BD sembrada. Si E2E_BASE_URL apunta a un servidor ya levantado, no se inicia otro.
export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `pnpm start -p ${port}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        // Auth.js en modo producción exige confiar en el host; el header público lee la sesión.
        // TRUST_PROXY: cada prueba envía su propia IP en X-Forwarded-For y los limitadores no se pisan.
        env: { AUTH_TRUST_HOST: 'true', TRUST_PROXY: 'true' },
        timeout: 60_000,
      },
});
