import { expect, test, type Page } from '@playwright/test';
import { randomIp, sessionFor, TestData } from './helpers';

// Cabeceras de seguridad y CSP (F5-01): las cabeceras llegan en cada tipo de ruta y el recorrido por el sitio
// (anónimo, cliente y personal) no provoca violaciones de la política ni errores de página. Datos propios.

const data = new TestData();

test.afterEach(async () => {
  await data.cleanup();
});
test.afterAll(async () => {
  await data.disconnect();
});

/** Registra las violaciones de CSP (evento del navegador) y los errores de consola/página de esa pestaña. */
async function watchCsp(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __csp: string[] };
    w.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      w.__csp.push(
        `${e.violatedDirective} ${e.blockedURI} ${e.sourceFile}:${e.lineNumber}:${e.columnNumber} ${e.sample}`
      );
    });
  });
  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && /content security policy|refused to/i.test(m.text()))
      problems.push(`console: ${m.text()}`);
  });
  return {
    async violations() {
      const fromEvents = await page.evaluate(
        () => (window as unknown as { __csp?: string[] }).__csp ?? []
      );
      return [...fromEvents, ...problems];
    },
  };
}

async function visit(page: Page, path: string, expected: RegExp) {
  const watcher = await watchCsp(page);
  const response = await page.goto(path);
  expect(response?.status(), path).toBeLessThan(400);
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  await expect(page).toHaveURL(expected);
  await page.waitForLoadState('networkidle');
  expect(await watcher.violations(), `violaciones en ${path}`).toEqual([]);
}

test.describe('Cabeceras de seguridad', () => {
  for (const path of ['/', '/catalogo', '/login', '/api/health', '/media/no-existe.webp']) {
    test(`${path} envía la CSP aplicada y las demás cabeceras`, async ({ request }) => {
      const response = await request.get(path, { headers: { 'x-forwarded-for': randomIp() } });
      const h = response.headers();
      const csp = h['content-security-policy'];
      expect(csp, 'CSP').toBeTruthy();
      expect(h['content-security-policy-report-only']).toBeUndefined();
      expect(csp).not.toContain('unsafe-eval');
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("base-uri 'self'");
      expect(csp).toContain("form-action 'self'");
      expect(h['cross-origin-opener-policy']).toBe('same-origin');
      expect(h['cross-origin-resource-policy']).toBe('same-origin');
      expect(h['x-content-type-options']).toBe('nosniff');
      expect(h['x-frame-options']).toBe('DENY');
      expect(h['x-powered-by']).toBeUndefined();
      // La prueba usa HTTP sin proxy: HSTS no debe enviarse.
      expect(h['strict-transport-security']).toBeUndefined();
    });
  }

  test('/admin (redirige a login) también lleva las cabeceras', async ({ request }) => {
    const response = await request.get('/admin', { maxRedirects: 0 });
    expect([302, 307, 308]).toContain(response.status());
    expect(response.headers()['content-security-policy']).toBeTruthy();
    expect(response.headers()['cross-origin-opener-policy']).toBe('same-origin');
  });

  test('HSTS solo cuando el proxy indica HTTPS', async ({ request }) => {
    const https = await request.get('/', { headers: { 'x-forwarded-proto': 'https' } });
    expect(https.headers()['strict-transport-security']).toBe(
      'max-age=31536000; includeSubDomains'
    );
    const http = await request.get('/', { headers: { 'x-forwarded-proto': 'http' } });
    expect(http.headers()['strict-transport-security']).toBeUndefined();
  });
});

test.describe('Recorrido sin violaciones de CSP', () => {
  test('visitante: portada, catálogo, ficha, login y registro', async ({ page }) => {
    const vehicle = await data.vehicle({ withPhoto: true });
    await page.context().setExtraHTTPHeaders({ 'x-forwarded-for': randomIp() });
    await visit(page, '/', /\/$/);
    await visit(page, '/catalogo', /\/catalogo/);
    await visit(page, `/vehiculos/${vehicle.id}`, new RegExp(`/vehiculos/${vehicle.id}`));
    await visit(page, '/login', /\/login/);
    await visit(page, '/registro', /\/registro/);
  });

  test('cliente: la página se hidrata (menú) y mi cuenta no viola la política', async ({
    browser,
  }) => {
    const client = await data.user('CLIENTE', 'Clienta');
    const { context, page } = await sessionFor(browser, client.email);
    try {
      const watcher = await watchCsp(page);
      await page.goto('/mi-cuenta');
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
      // Si la CSP bloqueara los scripts en línea o propios, el botón no abriría el menú (sin hidratación).
      await page
        .getByRole('button', { name: /Clienta/ })
        .first()
        .click();
      await expect(page.getByRole('menu')).toBeVisible();
      await page.goto('/mi-cuenta/reservas');
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
      await page.waitForLoadState('networkidle');
      expect(await watcher.violations()).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('personal: panel, vehículos y reservas', async ({ browser }) => {
    const admin = await data.user('ADMIN', 'Admina');
    const { context, page } = await sessionFor(browser, admin.email);
    try {
      await visit(page, '/admin', /\/admin$/);
      await visit(page, '/admin/vehiculos', /\/admin\/vehiculos/);
      await visit(page, '/admin/reservas', /\/admin\/reservas/);
    } finally {
      await context.close();
    }
  });
});
