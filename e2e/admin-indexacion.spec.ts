import { test, expect } from '@playwright/test';
import { siteContent } from '../src/lib/site-content';
import { randomInt } from 'node:crypto';
import { randomIp, sessionFor, TestData } from './helpers';

// Ninguna página del panel es indexable (F4-08): todas llevan `noindex`, el sitemap no las lista y robots.txt las
// excluye. Datos propios por prueba, borrados aunque falle.

const data = new TestData();

test.afterEach(async () => {
  await data.cleanup();
});
test.afterAll(async () => {
  await data.disconnect();
});
test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ 'x-forwarded-for': randomIp() });
});

test.describe('Indexación del panel', () => {
  test('todas las páginas de /admin llevan noindex (meta robots) y no se pueden seguir', async ({
    browser,
  }) => {
    const client = await data.user('CLIENTE');
    const reserved = await data.vehicle({ disponibilidad: 'RESERVADO' });
    const sold = await data.vehicle({ disponibilidad: 'VENDIDO' });
    const free = await data.vehicle();
    const code = `RES-2026-N${Math.floor(Math.random() * 1e6)
      .toString(36)
      .toUpperCase()
      .replace(/[01OIL]/g, '2')
      .padEnd(3, '2')
      .slice(0, 3)}`;
    await data.prisma.reserva.create({
      data: {
        codigoReserva: code,
        usuarioId: client.id,
        vehiculoId: reserved.id,
        estado: 'EN_NEGOCIACION',
      },
    });
    const receipt = `VTA-2031-8${randomInt(10000, 99999)}`;
    await data.prisma.venta.create({
      data: {
        numeroReciboContrato: receipt,
        vehiculoId: sold.id,
        compradorId: client.id,
        precioFinal: '1000.00',
        metodoPago: 'EFECTIVO',
        fechaVenta: new Date('2031-05-05T15:00:00Z'),
      },
    });

    const admin = await sessionFor(browser, (await data.user('ADMIN')).email);
    try {
      const paths = [
        '/admin',
        '/admin/reservas',
        `/admin/reservas/${code}`,
        '/admin/ventas',
        `/admin/ventas/${receipt}`,
        '/admin/vehiculos',
        '/admin/vehiculos/nuevo',
        '/admin/vehiculos/marcas',
        `/admin/vehiculos/${free.id}`,
        '/admin/usuarios',
        '/admin/configuracion',
      ];
      for (const path of paths) {
        await admin.page.goto(path);
        await expect(admin.page.getByRole('heading', { level: 1 }).first(), path).toBeVisible();
        const robots = await admin.page.locator('meta[name="robots"]').getAttribute('content');
        expect(robots, path).toContain('noindex');
        expect(robots, path).toContain('nofollow');
        expect(await admin.page.locator('meta[name="robots"]').count(), path).toBe(1);
      }
    } finally {
      await admin.context.close();
    }
  });

  test('el sitemap no lista ninguna ruta del panel ni de la cuenta, y robots.txt las excluye', async ({
    request,
  }) => {
    const sitemap = await (await request.get('/sitemap.xml')).text();
    for (const forbidden of ['/admin', '/mi-cuenta', '/login', '/registro', '/media']) {
      expect(sitemap, forbidden).not.toContain(forbidden);
    }
    expect(sitemap).toContain('/catalogo');

    const robots = await (await request.get('/robots.txt')).text();
    for (const disallowed of ['/admin', '/mi-cuenta', '/api']) {
      expect(robots, disallowed).toContain(`Disallow: ${disallowed}`);
    }
    expect(siteContent.admin.title).toBeTruthy();
  });
});
