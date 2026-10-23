import { randomBytes, randomInt } from 'node:crypto';
import { test, expect, type Browser, type Locator } from '@playwright/test';
import { Condicion, Disponibilidad, EstadoReserva, PrismaClient } from '@prisma/client';
import { hashSync } from 'bcryptjs';
import { siteContent } from '../src/lib/site-content';
import { E2E_EMAIL_DOMAIN, E2E_VEHICLE_COLOR_PREFIX } from './test-data';

// Datos temporales marcados (`@e2e-test.local`, color `E2E-RESERVAS-…`) que cada prueba borra aunque falle (con sus
// ventas) y que `global-setup.ts` barre. Las pruebas de listado usan ventas fechadas en 2031 y filtran por ese
// rango: nunca cuentan filas globales. Cada contexto usa su propia IP en `X-Forwarded-For` (TRUST_PROXY=true).

const PASSWORD = 'Clave-E2E-2026';
const PASSWORD_HASH = hashSync(PASSWORD, 4);
const prisma = new PrismaClient();
const copy = siteContent.adminSales;

let userIds: number[] = [];
let vehicleIds: number[] = [];

test.afterEach(async () => {
  await prisma.venta.deleteMany({
    where: { OR: [{ vehiculoId: { in: vehicleIds } }, { compradorId: { in: userIds } }] },
  });
  await prisma.reserva.deleteMany({
    where: { OR: [{ usuarioId: { in: userIds } }, { vehiculoId: { in: vehicleIds } }] },
  });
  await prisma.vehiculo.deleteMany({ where: { id: { in: vehicleIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  userIds = [];
  vehicleIds = [];
});
test.afterAll(async () => {
  await prisma.$disconnect();
});

const randomIp = () => `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`;

test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ 'x-forwarded-for': randomIp() });
});

async function makeUser(rol: 'ADMIN' | 'ASESOR' | 'CLIENTE', nombre = 'Persona') {
  const role = await prisma.role.findUniqueOrThrow({ where: { nombre: rol } });
  const tag = randomBytes(5).toString('hex');
  const user = await prisma.user.create({
    data: {
      rolId: role.id,
      nombre,
      apellido: `Ventas${tag}`,
      documentoIdentidad: `E2E${tag}`.toUpperCase(),
      email: `e2e-${tag}${E2E_EMAIL_DOMAIN}`,
      passwordHash: PASSWORD_HASH,
      telefono: '573105551234',
    },
  });
  userIds.push(user.id);
  return user;
}

async function makeReservation(estado: EstadoReserva = EstadoReserva.EN_NEGOCIACION) {
  const buyer = await makeUser('CLIENTE', 'Compradora');
  const color = `${E2E_VEHICLE_COLOR_PREFIX}vta-${randomBytes(4).toString('hex')}`;
  const vehicle = await prisma.vehiculo.create({
    data: {
      modeloId: 1,
      anio: 2021,
      color,
      condicion: Condicion.NUEVO,
      precio: 95000000,
      disponibilidad:
        estado === EstadoReserva.CANCELADA ? Disponibilidad.DISPONIBLE : Disponibilidad.RESERVADO,
      fotos: {
        create: [
          {
            urlFoto: 'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb',
            esPrincipal: true,
          },
        ],
      },
    },
  });
  vehicleIds.push(vehicle.id);
  const code = `RES-2026-F${randomBytes(2).toString('hex').toUpperCase().replace(/[01]/g, '2').slice(0, 3)}`;
  await prisma.reserva.create({
    data: { codigoReserva: code, usuarioId: buyer.id, vehiculoId: vehicle.id, estado },
  });
  return { code, color, vehicle, buyer };
}

async function sessionFor(
  browser: Browser,
  email: string,
  viewport?: { width: number; height: number }
) {
  const context = await browser.newContext({
    viewport,
    extraHTTPHeaders: { 'x-forwarded-for': randomIp() },
  });
  const page = await context.newPage();
  await page.goto('/login');
  const main = page.getByRole('main');
  await main.getByLabel('Correo electrónico').fill(email);
  await main.getByLabel('Contraseña').fill(PASSWORD);
  await main.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).not.toHaveURL(/\/login/);
  return { context, page };
}

/** React reinicia el formulario al terminar la acción: se reintenta el relleno hasta que el valor «se queda». */
async function fillStable(locator: Locator, value: string) {
  await expect(async () => {
    await locator.fill(value);
    await expect(locator).toHaveValue(value, { timeout: 500 });
  }).toPass({ timeout: 8000 });
}

const RECEIPT_URL = /\/admin\/ventas\/VTA-\d{4}-\d{6}$/;

test.describe('Registro de ventas (/admin/reservas y /admin/ventas)', () => {
  test('ASESOR registra la venta: reserva COMPLETADA, vehículo VENDIDO fuera del catálogo y de la ficha, y fila en ventas', async ({
    browser,
  }) => {
    const { code, color, vehicle, buyer } = await makeReservation();
    const seller = await makeUser('ASESOR', 'Vendedor');
    const { context, page } = await sessionFor(browser, seller.email);
    try {
      // Antes: el vehículo es visible en el catálogo (reservado)
      await page.goto(`/catalogo?color=${encodeURIComponent(color)}`);
      await expect(page.getByRole('main').getByRole('article')).toHaveCount(1);

      await page.goto(`/admin/reservas/${code}`);
      const main = page.getByRole('main');
      // El precio por defecto es el del vehículo
      await expect(main.getByLabel(copy.form.price)).toHaveValue('95000000.00');
      await main.getByLabel(copy.form.price).fill('93500000.50');
      await main.getByLabel(copy.form.method).selectOption('CREDITO');
      await main.getByLabel(copy.form.notes).fill('Entrega pactada <b>lunes</b>');
      await main.getByLabel(copy.form.confirm).check();
      await main.getByRole('button', { name: copy.form.submit }).click();

      await expect(page).toHaveURL(RECEIPT_URL);
      const receipt = page.url().split('/').pop()!;
      await expect(
        page.getByRole('main').getByRole('heading', { name: receipt, level: 1 })
      ).toBeVisible();
      await expect(page.getByRole('main').getByText('$ 93.500.000,50')).toBeVisible();
      await expect(
        page.getByRole('region', { name: copy.detailTitle }).getByText(copy.methodLabels.CREDITO)
      ).toBeVisible();
      await expect(
        page.getByRole('main').getByText(`Compradora Ventas`, { exact: false }).first()
      ).toBeVisible();
      await expect(
        page.getByRole('main').getByText('Vendedor Ventas', { exact: false }).first()
      ).toBeVisible();
      // Las observaciones se muestran como texto
      await expect(
        page
          .getByRole('region', { name: copy.detailTitle })
          .getByText('Entrega pactada <b>lunes</b>')
      ).toBeVisible();
      await expect(page.locator('main b')).toHaveCount(0);

      // Base de datos
      expect(
        (await prisma.reserva.findUniqueOrThrow({ where: { codigoReserva: code } })).estado
      ).toBe('COMPLETADA');
      expect(await prisma.vehiculo.findUniqueOrThrow({ where: { id: vehicle.id } })).toMatchObject({
        disponibilidad: 'VENDIDO',
        visibleCatalogo: false,
      });
      const venta = await prisma.venta.findUniqueOrThrow({
        where: { numeroReciboContrato: receipt },
      });
      expect(venta).toMatchObject({
        vehiculoId: vehicle.id,
        compradorId: buyer.id, // el usuario de la reserva
        vendedorUsuarioId: seller.id, // el usuario de la sesión
        metodoPago: 'CREDITO',
      });
      expect(venta.precioFinal.toFixed(2)).toBe('93500000.50');

      // Fuera del catálogo y de la ficha pública
      await page.goto(`/catalogo?color=${encodeURIComponent(color)}`);
      await expect(page.getByRole('main').getByRole('article')).toHaveCount(0);
      await page.goto(`/vehiculos/${vehicle.id}`);
      await expect(
        page.getByRole('heading', { name: siteContent.seo.notFoundVehicleTitle })
      ).toBeVisible();

      // La reserva ya es final: sin formulario de venta ni botones de estado
      await page.goto(`/admin/reservas/${code}`);
      await expect(
        page.getByRole('main').getByRole('button', { name: copy.form.submit })
      ).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test('doble envío o dos personas a la vez: una sola venta y un aviso claro para la otra', async ({
    browser,
  }) => {
    const { code, vehicle } = await makeReservation();
    const a = await sessionFor(browser, (await makeUser('ASESOR')).email);
    const b = await sessionFor(browser, (await makeUser('ADMIN')).email);
    try {
      for (const { page } of [a, b]) {
        await page.goto(`/admin/reservas/${code}`);
        const main = page.getByRole('main');
        await main.getByLabel(copy.form.confirm).check();
        await expect(main.getByRole('button', { name: copy.form.submit })).toBeEnabled();
      }
      await Promise.all(
        [a, b].map(({ page }) =>
          page.getByRole('main').getByRole('button', { name: copy.form.submit }).click()
        )
      );

      await expect
        .poll(() => [a, b].filter(({ page }) => RECEIPT_URL.test(page.url())).length)
        .toBe(1);
      const loser = [a, b].find(({ page }) => !RECEIPT_URL.test(page.url()))!.page;
      await expect(
        loser.getByRole('main').getByRole('alert').filter({ hasText: copy.errors.invalidState })
      ).toBeVisible();
      expect(await prisma.venta.count({ where: { vehiculoId: vehicle.id } })).toBe(1);
    } finally {
      await a.context.close();
      await b.context.close();
    }
  });

  test('validación: precio inválido, método no válido y casilla sin marcar no registran nada', async ({
    browser,
  }) => {
    const { code, vehicle } = await makeReservation();
    const { context, page } = await sessionFor(browser, (await makeUser('ASESOR')).email);
    try {
      await page.goto(`/admin/reservas/${code}`);
      const main = page.getByRole('main');
      const price = main.getByLabel(copy.form.price);
      const submit = main.getByRole('button', { name: copy.form.submit });
      const confirm = main.getByLabel(copy.form.confirm);

      // Sin confirmar: el servidor lo exige (la casilla `required` solo es ayuda del navegador)
      await fillStable(price, '90000000');
      await submit.click();
      await expect(page).not.toHaveURL(RECEIPT_URL);

      await confirm.check();
      await fillStable(price, '0');
      await submit.click();
      await expect(main.getByText(copy.errors.price)).toBeVisible();
      // la casilla se conserva tras el error
      await expect(confirm).toBeChecked();

      await fillStable(price, '1.234.567');
      await submit.click();
      await expect(main.getByText(copy.errors.price)).toBeVisible();

      await fillStable(price, '90000000');
      await fillStable(main.getByLabel(copy.form.notes), 'x'.repeat(1100));
      await submit.click();
      await expect(main.getByText(copy.errors.notes)).toBeVisible();

      expect(await prisma.venta.count({ where: { vehiculoId: vehicle.id } })).toBe(0);
      expect(
        (await prisma.reserva.findUniqueOrThrow({ where: { codigoReserva: code } })).estado
      ).toBe('EN_NEGOCIACION');
    } finally {
      await context.close();
    }
  });

  test('una reserva cancelada no ofrece registrar la venta', async ({ browser }) => {
    const { code } = await makeReservation(EstadoReserva.CANCELADA);
    const { context, page } = await sessionFor(browser, (await makeUser('ASESOR')).email);
    try {
      await page.goto(`/admin/reservas/${code}`);
      await expect(
        page.getByRole('main').getByRole('heading', { name: code, level: 1 })
      ).toBeVisible();
      await expect(
        page.getByRole('main').getByRole('button', { name: copy.form.submit })
      ).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test('listado: filtra por rango de fechas y el total del periodo es la suma decimal exacta', async ({
    browser,
  }) => {
    const buyer = await makeUser('CLIENTE', 'Comprador');
    const rows: { price: string; receipt: string }[] = [];
    for (const price of ['0.10', '0.20']) {
      const color = `${E2E_VEHICLE_COLOR_PREFIX}vtl-${randomBytes(4).toString('hex')}`;
      const vehicle = await prisma.vehiculo.create({
        data: {
          modeloId: 1,
          anio: 2021,
          color,
          condicion: Condicion.NUEVO,
          precio: 1000,
          disponibilidad: 'VENDIDO',
          visibleCatalogo: false,
        },
      });
      vehicleIds.push(vehicle.id);
      const receipt = `VTA-2031-9${randomInt(10000, 99999)}`;
      rows.push({ price, receipt });
      await prisma.venta.create({
        data: {
          numeroReciboContrato: receipt,
          vehiculoId: vehicle.id,
          compradorId: buyer.id,
          precioFinal: price,
          metodoPago: 'EFECTIVO',
          fechaVenta: new Date('2031-03-15T15:00:00Z'),
        },
      });
    }
    const { context, page } = await sessionFor(browser, (await makeUser('ASESOR')).email);
    try {
      await page.goto('/admin/ventas?desde=2031-03-01&hasta=2031-03-31');
      const main = page.getByRole('main');
      await expect(main.getByRole('row').filter({ hasText: rows[0]!.receipt })).toHaveCount(1);
      await expect(main.getByRole('row').filter({ hasText: rows[1]!.receipt })).toHaveCount(1);
      // 0,10 + 0,20 = 0,30 exacto (en coma flotante sería 0,30000000000000004)
      await expect(main.getByTestId('sales-total')).toHaveText('$ 0,30');

      await page.goto('/admin/ventas?desde=2031-04-01&hasta=2031-04-30');
      await expect(page.getByRole('main').getByText(copy.empty)).toBeVisible();
      await expect(page.getByRole('main').getByTestId('sales-total')).toHaveText('$ 0');

      // Rango inválido: aviso y se muestran todas
      await page.goto('/admin/ventas?desde=2031-04-30&hasta=2031-04-01');
      await expect(
        page.getByRole('main').getByRole('alert').filter({ hasText: copy.filters.invalidRange })
      ).toBeVisible();

      // Detalle de solo lectura
      await page.goto(`/admin/ventas/${rows[0]!.receipt}`);
      await expect(
        page.getByRole('main').getByRole('heading', { name: rows[0]!.receipt, level: 1 })
      ).toBeVisible();
      await expect(page.getByRole('main').getByText(copy.readOnly)).toBeVisible();
      await expect(page.getByRole('main').getByRole('button')).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test('autorización: CLIENTE 404, anónimo a login, recibos mal formados o inexistentes «no encontrado»', async ({
    browser,
    page,
  }) => {
    for (const path of ['/admin/ventas', '/admin/ventas/VTA-2031-000001']) {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(path)}$`));
    }
    const client = await sessionFor(browser, (await makeUser('CLIENTE')).email);
    const staff = await sessionFor(browser, (await makeUser('ASESOR')).email);
    try {
      expect((await client.page.goto('/admin/ventas'))?.status()).toBe(404);
      expect((await client.page.goto('/admin/ventas/VTA-2031-000001'))?.status()).toBe(404);
      for (const bad of ['VTA-1-1', '..%2F', '%3Cscript%3E', 'VTA-2031-000999']) {
        await staff.page.goto(`/admin/ventas/${bad}`);
        await expect(
          staff.page.getByRole('heading', { name: siteContent.errorPages.notFoundTitle })
        ).toBeVisible();
      }
    } finally {
      await client.context.close();
      await staff.context.close();
    }
  });

  test('sin scroll horizontal a 360 px en el listado (con un total grande) y en el formulario de venta', async ({
    browser,
  }) => {
    const { code } = await makeReservation();
    const buyer = await makeUser('CLIENTE', 'Comprador');
    const vehicle = await prisma.vehiculo.create({
      data: {
        modeloId: 1,
        anio: 2021,
        color: `${E2E_VEHICLE_COLOR_PREFIX}vtg-${randomBytes(4).toString('hex')}`,
        condicion: Condicion.NUEVO,
        precio: 1000,
        disponibilidad: 'VENDIDO',
        visibleCatalogo: false,
      },
    });
    vehicleIds.push(vehicle.id);
    await prisma.venta.create({
      data: {
        numeroReciboContrato: `VTA-2031-9${randomInt(10000, 99999)}`,
        vehiculoId: vehicle.id,
        compradorId: buyer.id,
        precioFinal: '9999999999.99', // el total más largo posible
        metodoPago: 'MIXTO',
        fechaVenta: new Date('2031-09-15T15:00:00Z'),
      },
    });
    const { context, page } = await sessionFor(browser, (await makeUser('ASESOR')).email, {
      width: 360,
      height: 800,
    });
    try {
      for (const path of [
        '/admin/ventas?desde=2031-09-01&hasta=2031-09-30',
        `/admin/reservas/${code}`,
      ]) {
        await page.goto(path);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
          path
        ).toBeLessThanOrEqual(0);
      }
      await page.goto('/admin/ventas?desde=2031-09-01&hasta=2031-09-30');
      await expect(page.getByTestId('sales-total')).toHaveText('$ 9.999.999.999,99');
    } finally {
      await context.close();
    }
  });
});
