import { expect, test, type BrowserContext } from '@playwright/test';
import { essentialCookies } from '../src/lib/legal-content';
import { randomIp, sessionFor, TestData } from './helpers';

// Cookies (F5-04): la aplicación solo usa cookies estrictamente necesarias; si aparece otra, esta prueba falla.
// También: sin contenido legal, /privacidad y /terminos dan 404 y nada las enlaza. Datos propios.

const data = new TestData();
test.afterEach(async () => {
  await data.cleanup();
});
test.afterAll(async () => {
  await data.disconnect();
});

/** `__Secure-`/`__Host-` los añade Auth.js en HTTPS. */
const bare = (name: string) => name.replace(/^__(Secure|Host)-/, '');
const ALLOWED = new Set(essentialCookies.map((c) => c.name));

async function cookieNames(context: BrowserContext) {
  return (await context.cookies()).map((c) => bare(c.name));
}

test.describe('Cookies', () => {
  test('anónimo: tras recorrer el sitio solo hay cookies de la lista', async ({ page }) => {
    await page.context().setExtraHTTPHeaders({ 'x-forwarded-for': randomIp() });
    for (const path of ['/', '/catalogo', '/como-funciona', '/contacto', '/login', '/registro']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    }
    const names = await cookieNames(page.context());
    expect(
      names.filter((n) => !ALLOWED.has(n)),
      `cookies no declaradas: ${names.join(', ')}`
    ).toEqual([]);
  });

  test('usuario autenticado: sesión y CSRF son las únicas cookies', async ({ browser }) => {
    const client = await data.user('CLIENTE', 'Clienta');
    const { context, page } = await sessionFor(browser, client.email);
    try {
      for (const path of ['/mi-cuenta', '/mi-cuenta/reservas', '/catalogo', '/']) {
        await page.goto(path);
        await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
      }
      const names = await cookieNames(context);
      expect(names).toContain('authjs.session-token');
      expect(
        names.filter((n) => !ALLOWED.has(n)),
        `cookies no declaradas: ${names.join(', ')}`
      ).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('el personal tampoco introduce cookies nuevas en el panel', async ({ browser }) => {
    const admin = await data.user('ADMIN', 'Admina');
    const { context, page } = await sessionFor(browser, admin.email);
    try {
      for (const path of ['/admin', '/admin/vehiculos', '/admin/reservas', '/admin/usuarios']) {
        await page.goto(path);
        await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
      }
      const names = await cookieNames(context);
      expect(
        names.filter((n) => !ALLOWED.has(n)),
        `cookies no declaradas: ${names.join(', ')}`
      ).toEqual([]);
    } finally {
      await context.close();
    }
  });
});

test.describe('Páginas legales sin contenido del propietario', () => {
  for (const path of ['/privacidad', '/terminos']) {
    test(`${path} responde 404`, async ({ request }) => {
      const response = await request.get(path, { headers: { 'x-forwarded-for': randomIp() } });
      expect(response.status()).toBe(404);
    });
  }

  test('ninguna página enlaza a ellas (pie, registro) y el sitemap no las lista', async ({
    page,
    request,
  }) => {
    await page.context().setExtraHTTPHeaders({ 'x-forwarded-for': randomIp() });
    for (const path of ['/', '/registro', '/contacto']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
      await expect(page.locator('a[href="/privacidad"], a[href="/terminos"]')).toHaveCount(0);
    }
    const sitemap = await (await request.get('/sitemap.xml')).text();
    expect(sitemap).not.toContain('/privacidad');
    expect(sitemap).not.toContain('/terminos');
  });
});
