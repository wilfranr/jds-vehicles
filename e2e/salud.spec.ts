import { expect, test } from '@playwright/test';

// Salud de la aplicación (F5-03): el servidor de e2e tiene BD y carpeta de subidas sanas.
test.describe('Salud', () => {
  test('/api/health responde 200 con un informe mínimo y sin caché', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.status()).toBe(200);
    expect(response.headers()['cache-control']).toBe('no-store');
    expect(await response.json()).toEqual({ status: 'ok', db: 'up', uploads: 'ok', disk: 'ok' });
  });

  test('/api/health/live responde 200 y no depende de la BD', async ({ request }) => {
    const response = await request.get('/api/health/live');
    expect(response.status()).toBe(200);
    expect(response.headers()['cache-control']).toBe('no-store');
    expect(await response.json()).toEqual({ status: 'ok' });
  });
});
