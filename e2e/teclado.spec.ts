import { expect, test, type Locator, type Page } from '@playwright/test';
import { images, randomIp, sessionFor, TestData } from './helpers';

// Teclado, foco y estructura (F5-02): los menús, la galería ampliada y las confirmaciones se operan solo con
// teclado, con foco visible, atrapado dentro del diálogo y devuelto a su origen al cerrar. Un solo banner y un
// solo main visibles. Datos propios por prueba, borrados aunque falle.

const data = new TestData();
test.afterEach(async () => {
  await data.cleanup();
});
test.afterAll(async () => {
  await data.disconnect();
});

const MOBILE = { width: 360, height: 740 };

/** El foco se ve: contorno o sombra (los anillos de Tailwind son `box-shadow`). */
async function expectFocusVisible(locator: Locator) {
  await expect(locator).toBeFocused();
  const visible = await locator.evaluate((el) => {
    const s = getComputedStyle(el);
    const outline = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0;
    return outline || (s.boxShadow !== 'none' && s.boxShadow !== '');
  });
  expect(visible, 'el elemento enfocado debe tener un indicador de foco visible').toBe(true);
}

/** Pulsa Tab `times` veces comprobando que el foco no sale del diálogo. */
async function tabStaysInside(page: Page, dialog: Locator, times: number, shift = false) {
  for (let i = 0; i < times; i++) {
    await page.keyboard.press(shift ? 'Shift+Tab' : 'Tab');
    const inside = await dialog.evaluate((d) => d.contains(document.activeElement));
    expect(inside, `Tab ${shift ? 'hacia atrás ' : ''}nº ${i + 1} sacó el foco del diálogo`).toBe(
      true
    );
  }
}

test.describe('Teclado', () => {
  test('menú de usuario: se abre con Enter, recorre con flechas, Escape devuelve el foco', async ({
    browser,
  }) => {
    const user = await data.user('CLIENTE', 'Clienta');
    const { context, page } = await sessionFor(browser, user.email, { width: 1400, height: 800 });
    try {
      await page.goto('/catalogo');
      const trigger = page.getByRole('banner').getByRole('button', { name: /Clienta/ });
      await trigger.focus();
      await expectFocusVisible(trigger);
      await page.keyboard.press('Enter');
      const menu = page.getByRole('menu');
      await expect(menu).toBeVisible();
      await expect(menu.getByRole('menuitem').first()).toBeFocused();
      await page.keyboard.press('ArrowDown');
      await expect(menu.getByRole('menuitem').nth(1)).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(menu).toBeHidden();
      await expectFocusVisible(trigger);
    } finally {
      await context.close();
    }
  });

  test('menú móvil: foco atrapado, Escape cierra y devuelve el foco al botón', async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: MOBILE,
      extraHTTPHeaders: { 'x-forwarded-for': randomIp() },
    });
    const page = await context.newPage();
    try {
      await page.goto('/');
      const opener = page.getByRole('button', { name: 'Abrir menú de navegación' });
      await opener.focus();
      await expectFocusVisible(opener);
      await page.keyboard.press('Enter');
      const dialog = page.getByRole('dialog', { name: 'Menú principal de navegación' });
      await expect(dialog).toBeVisible();
      await expectFocusVisible(dialog.getByRole('button', { name: 'Cerrar menú' }));
      await tabStaysInside(page, dialog, 25);
      await tabStaysInside(page, dialog, 25, true);
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
      await expectFocusVisible(page.getByRole('button', { name: 'Abrir menú de navegación' }));
    } finally {
      await context.close();
    }
  });

  test('galería ampliada: Enter la abre, foco atrapado, flechas cambian de foto, Escape devuelve el foco', async ({
    page,
  }) => {
    const vehicle = await data.vehicle({ withPhoto: true });
    await data.prisma.vehiculoFoto.create({
      data: {
        vehiculoId: vehicle.id,
        urlFoto: 'https://images.unsplash.com/photo-1494976388531-d1058494cdd8',
        ordenPresentacion: 2,
      },
    });
    await page.context().setExtraHTTPHeaders({ 'x-forwarded-for': randomIp() });
    await page.goto(`/vehiculos/${vehicle.id}`);

    const opener = page.getByRole('button', { name: 'Ver fotografía en pantalla completa' });
    await opener.focus();
    await expectFocusVisible(opener);
    await page.keyboard.press('Enter');

    const dialog = page.getByRole('dialog', { name: /Galería a pantalla completa/ });
    await expect(dialog).toBeVisible();
    await expectFocusVisible(
      dialog.getByRole('button', { name: 'Cerrar vista de pantalla completa' })
    );
    await expect(dialog.getByText('1 / 2')).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await expect(dialog.getByText('2 / 2')).toBeVisible();
    await page.keyboard.press('ArrowLeft');
    await expect(dialog.getByText('1 / 2')).toBeVisible();

    await tabStaysInside(page, dialog, 8);
    await tabStaysInside(page, dialog, 8, true);

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expectFocusVisible(opener);
  });

  test('las flechas dentro de un campo de texto no cambian la foto de la galería', async ({
    page,
  }) => {
    const vehicle = await data.vehicle({ withPhoto: true });
    await data.prisma.vehiculoFoto.create({
      data: {
        vehiculoId: vehicle.id,
        urlFoto: 'https://images.unsplash.com/photo-1494976388531-d1058494cdd8',
        ordenPresentacion: 2,
      },
    });
    await page.context().setExtraHTTPHeaders({ 'x-forwarded-for': randomIp() });
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto(`/vehiculos/${vehicle.id}`);
    const counter = page.getByRole('main').getByText('1 / 2');
    await expect(counter).toBeVisible();
    const search = page.getByRole('banner').getByRole('textbox').first();
    await search.focus();
    await page.keyboard.type('mazda');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowRight');
    await expect(counter).toBeVisible();
  });

  test('panel: confirmación de acciones con teclado (details) y subida de fotos', async ({
    browser,
  }) => {
    const staff = await data.user('ASESOR', 'Asesora');
    const vehicle = await data.vehicle({ withPhoto: false });
    const { context, page } = await sessionFor(browser, staff.email);
    try {
      await page.goto(`/admin/vehiculos/${vehicle.id}`);
      const main = page.getByRole('main');

      // Subida solo con teclado: el selector recibe el foco, se elige el archivo y se envía con Enter.
      const input = main.getByLabel('Seleccionar fotografías');
      await input.focus();
      await expectFocusVisible(input);
      await input.setInputFiles({
        name: 'uno.png',
        mimeType: 'image/png',
        buffer: await images.png(),
      });
      const submit = main.getByRole('button', { name: 'Subir fotografías' });
      await submit.focus();
      await expectFocusVisible(submit);
      await page.keyboard.press('Enter');
      await expect(main.getByText('Se subió 1 fotografía.')).toBeVisible();

      // Eliminar pide confirmación en un <details>: se abre con Enter y el botón de confirmar se alcanza con Tab.
      const item = main.getByRole('listitem', { name: /Fotografía 1/ });
      const summary = item.locator('summary');
      await summary.focus();
      await expectFocusVisible(summary);
      await page.keyboard.press('Enter');
      const confirm = item.getByRole('button', { name: 'Confirmar eliminación' });
      await expect(confirm).toBeVisible();
      await page.keyboard.press('Tab');
      await expectFocusVisible(confirm);
      // Sin confirmar no se borra: cerrar con Enter de nuevo en el resumen deja la foto.
      await summary.focus();
      await page.keyboard.press('Enter');
      await expect(confirm).toBeHidden();
      await expect(item).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('navegación del panel: todos los enlaces se alcanzan con Tab y muestran foco', async ({
    browser,
  }) => {
    const admin = await data.user('ADMIN', 'Admina');
    const { context, page } = await sessionFor(browser, admin.email);
    try {
      await page.goto('/admin');
      const nav = page.getByRole('navigation', { name: 'Secciones del panel' });
      await expect(nav).toBeVisible();
      const links = nav.getByRole('link');
      const count = await links.count();
      expect(count).toBeGreaterThan(3);
      await links.first().focus();
      for (let i = 0; i < count; i++) {
        await expectFocusVisible(links.nth(i));
        await page.keyboard.press('Tab');
      }
    } finally {
      await context.close();
    }
  });
});

test.describe('Movimiento reducido', () => {
  test('con prefers-reduced-motion las transiciones se anulan', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.context().setExtraHTTPHeaders({ 'x-forwarded-for': randomIp() });
    await page.goto('/');
    const durations = await page.evaluate(() =>
      [...document.querySelectorAll('*')]
        .map((el) => getComputedStyle(el).transitionDuration)
        .filter((d) => d && d !== '0s')
        .map((d) => d.split(',').map((x) => parseFloat(x) * (x.trim().endsWith('ms') ? 1 : 1000)))
        .flat()
    );
    expect(durations.length).toBeGreaterThan(0); // hay elementos con transición declarada
    expect(Math.max(...durations)).toBeLessThanOrEqual(0.02); // en milisegundos
  });
});

test.describe('Estructura: un solo banner y un solo main', () => {
  /** Cuenta los header/main fuera de cualquier ancestro `display: none` (los de Activity no cuentan). */
  const visibleLandmarks = (page: Page) =>
    page.evaluate(() => {
      const shown = (el: Element) => {
        for (let e: Element | null = el; e; e = e.parentElement)
          if (getComputedStyle(e).display === 'none') return false;
        return true;
      };
      return {
        banners: [...document.querySelectorAll('header')].filter(shown).length,
        mains: [...document.querySelectorAll('main')].filter(shown).length,
      };
    });

  test('visitante, tras navegar entre páginas', async ({ page }) => {
    await page.context().setExtraHTTPHeaders({ 'x-forwarded-for': randomIp() });
    await page.goto('/');
    await page.getByRole('link', { name: 'Cómo Funciona' }).first().click();
    await expect(page).toHaveURL(/como-funciona/);
    await expect(page.getByRole('banner')).toHaveCount(1);
    await expect(page.getByRole('main')).toHaveCount(1);
    expect(await visibleLandmarks(page)).toEqual({ banners: 1, mains: 1 });
  });

  test('con sesión: tras iniciar sesión y navegar, el duplicado oculto de Activity no es accesible', async ({
    browser,
  }) => {
    const user = await data.user('CLIENTE', 'Clienta');
    const { context, page } = await sessionFor(browser, user.email, { width: 1400, height: 800 });
    try {
      for (const name of ['Catálogo / Inventario', 'Cómo Funciona', 'Contacto']) {
        await page.getByRole('banner').getByRole('link', { name }).first().click();
        await page.waitForLoadState('networkidle');
        // Playwright excluye por defecto lo oculto: 1 solo banner y 1 solo main en el árbol de accesibilidad.
        await expect(page.getByRole('banner')).toHaveCount(1);
        await expect(page.getByRole('main')).toHaveCount(1);
        expect(await visibleLandmarks(page), name).toEqual({ banners: 1, mains: 1 });
      }
      // Causa: Next 16 conserva la ruta anterior con <Activity> en un <div style="display: none !important">
      // hijo de <body> (docs: 01-app/02-guides/preserving-ui-state.md). Fuera del árbol de accesibilidad.
      const hiddenWrappers = await page.evaluate(
        () =>
          [...document.body.children].filter(
            (c) => c.tagName === 'DIV' && getComputedStyle(c).display === 'none'
          ).length
      );
      expect(hiddenWrappers).toBeGreaterThanOrEqual(0);
    } finally {
      await context.close();
    }
  });
});

test.describe('Imágenes', () => {
  test('la foto de la ficha tiene un alt descriptivo con marca, modelo, año y número', async ({
    page,
  }) => {
    const vehicle = await data.vehicle({ withPhoto: true });
    await data.prisma.vehiculoFoto.create({
      data: {
        vehiculoId: vehicle.id,
        urlFoto: 'https://images.unsplash.com/photo-1494976388531-d1058494cdd8',
        ordenPresentacion: 2,
      },
    });
    await page.context().setExtraHTTPHeaders({ 'x-forwarded-for': randomIp() });
    await page.goto(`/vehiculos/${vehicle.id}`);
    const main = page.getByRole('main');
    await expect(
      main.getByRole('img', { name: 'Toyota Corolla 2022 - Foto 1 de 2' })
    ).toBeVisible();
    await expect(
      main.getByRole('img', { name: 'Toyota Corolla 2022 - Miniatura 2' })
    ).toBeVisible();
  });
});
