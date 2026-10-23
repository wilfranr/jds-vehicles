import { test, expect } from '@playwright/test';

test.describe('Recorrido del catálogo público', () => {
  test('portada → catálogo → filtro de condición → detalle con CTA y galería', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    await page.getByRole('link', { name: 'Ver todo el inventario' }).first().click();
    await expect(page).toHaveURL(/\/catalogo$/);

    // Filtro de condición: el control es un radio oculto dentro de una etiqueta.
    const filters = page.getByRole('complementary', { name: 'Filtros del catálogo' });
    await filters.getByText('Nuevo', { exact: true }).click();
    await filters.getByRole('button', { name: 'Aplicar Filtros' }).click();
    await expect(page).toHaveURL(/condicion=NUEVO/);

    // Solo tarjetas con foto: otras pruebas crean vehículos temporales sin fotos, y la galería necesita una.
    const detailLinks = page.locator('article:has(img) a[href^="/vehiculos/"]');
    await expect(detailLinks.first()).toBeVisible();
    await detailLinks.first().click();

    await expect(page).toHaveURL(/\/vehiculos\/\d+$/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // CTA de WhatsApp con mensaje prellenado
    const cta = page
      .getByRole('link', { name: /WhatsApp/i })
      .filter({ hasText: /Consultar|Escribir|Preguntar/ });
    await expect(cta.first()).toHaveAttribute('href', /^https:\/\/wa\.me\/\d+\?text=/);

    // Galería: imagen principal y apertura a pantalla completa
    // Se reintenta el clic: bajo carga puede llegar antes de la hidratación y no abrir el diálogo.
    await expect(async () => {
      await page.getByRole('button', { name: 'Ver fotografía en pantalla completa' }).click();
      await expect(page.getByRole('dialog', { name: /Galería a pantalla completa/ })).toBeVisible({
        timeout: 1500,
      });
    }).toPass({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Cerrar vista de pantalla completa' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
  });

  test('el detalle publica JSON-LD de tipo Car con oferta en COP', async ({ page }) => {
    await page.goto('/catalogo');
    await page.locator('a[href^="/vehiculos/"]').first().click();
    const raw = await page.locator('script[type="application/ld+json"]').first().textContent();
    const data = JSON.parse(raw ?? '{}');
    expect(data['@type']).toBe('Car');
    expect(data.offers.priceCurrency).toBe('COP');
  });

  test('una página inexistente responde 404 con el diseño del sitio', async ({ page }) => {
    const response = await page.goto('/esta-pagina-no-existe');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: 'Página no encontrada' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ver el catálogo' })).toBeVisible();
  });

  test('sitemap.xml y robots.txt responden', async ({ request }) => {
    const sitemap = await request.get('/sitemap.xml');
    expect(sitemap.status()).toBe(200);
    expect(await sitemap.text()).toContain('/catalogo');

    const robots = await request.get('/robots.txt');
    expect(robots.status()).toBe(200);
    expect(await robots.text()).toContain('Disallow: /api');
  });
});
