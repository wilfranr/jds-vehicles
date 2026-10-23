import { randomBytes, randomInt } from 'node:crypto';
import { test, expect, type Browser, type Page } from '@playwright/test';
import { Condicion, Disponibilidad, EstadoReserva, PrismaClient } from '@prisma/client';
import { hashSync } from 'bcryptjs';
import { siteContent } from '../src/lib/site-content';
import { E2E_BRAND_PREFIX, E2E_EMAIL_DOMAIN, E2E_VEHICLE_COLOR_PREFIX } from './test-data';

// Datos temporales marcados (`@e2e-test.local`, color `E2E-RESERVAS-…`, marcas `E2E-MARCA-…`): cada prueba los
// borra aunque falle y `global-setup.ts` barre los restos. Cada contexto usa su propia IP (TRUST_PROXY=true).

const PASSWORD = 'Clave-E2E-2026';
const PASSWORD_HASH = hashSync(PASSWORD, 4);
const prisma = new PrismaClient();
const copy = siteContent.adminVehicles;

let userIds: number[] = [];
let vehicleColors: string[] = [];
let brandNames: string[] = [];

test.afterEach(async () => {
  const vehicles = await prisma.vehiculo.findMany({
    where: { color: { in: vehicleColors } },
    select: { id: true },
  });
  const ids = vehicles.map((v) => v.id);
  await prisma.reserva.deleteMany({
    where: { OR: [{ vehiculoId: { in: ids } }, { usuarioId: { in: userIds } }] },
  });
  await prisma.vehiculo.deleteMany({ where: { id: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.modelo.deleteMany({ where: { marca: { nombre: { in: brandNames } } } });
  await prisma.marca.deleteMany({ where: { nombre: { in: brandNames } } });
  userIds = [];
  vehicleColors = [];
  brandNames = [];
});
test.afterAll(async () => {
  await prisma.$disconnect();
});

const randomIp = () => `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`;

test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ 'x-forwarded-for': randomIp() });
});

async function makeUser(rol: 'ADMIN' | 'ASESOR' | 'CLIENTE') {
  const role = await prisma.role.findUniqueOrThrow({ where: { nombre: rol } });
  const tag = randomBytes(5).toString('hex');
  const user = await prisma.user.create({
    data: {
      rolId: role.id,
      nombre: 'Inventario',
      apellido: 'Automática',
      documentoIdentidad: `E2E${tag}`.toUpperCase(),
      email: `e2e-${tag}${E2E_EMAIL_DOMAIN}`,
      passwordHash: PASSWORD_HASH,
      telefono: '573105551234',
    },
  });
  userIds.push(user.id);
  return user;
}

async function sessionFor(browser: Browser, email: string) {
  const context = await browser.newContext({ extraHTTPHeaders: { 'x-forwarded-for': randomIp() } });
  const page = await context.newPage();
  await page.goto('/login');
  const main = page.getByRole('main');
  await main.getByLabel('Correo electrónico').fill(email);
  await main.getByLabel('Contraseña').fill(PASSWORD);
  await main.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).not.toHaveURL(/\/login/);
  return { context, page };
}

function uniqueColor(): string {
  const color = `${E2E_VEHICLE_COLOR_PREFIX}adm-${randomBytes(4).toString('hex')}`;
  vehicleColors.push(color);
  return color;
}

const plate = () => `E${randomBytes(3).toString('hex').toUpperCase()}`;

async function fillVehicle(
  page: Page,
  v: { color: string; condicion: 'NUEVO' | 'USADO'; placa?: string; km?: string }
) {
  const main = page.getByRole('main');
  await expect(main.getByLabel(copy.labels.modeloId)).toBeVisible();
  await main.getByLabel(copy.labels.modeloId).selectOption({ label: 'Toyota Corolla' });
  await main.getByLabel(copy.labels.anio).fill('2021');
  await main.getByLabel(copy.labels.color).fill(v.color);
  await main.getByLabel(copy.labels.condicion).selectOption(v.condicion);
  if (v.placa !== undefined) await main.getByLabel(copy.labels.placa).fill(v.placa);
  await main.getByLabel(copy.labels.kilometraje).fill(v.km ?? '0');
  await main.getByLabel(copy.labels.transmision).selectOption('AUTOMATICA');
  await main.getByLabel(copy.labels.combustible).selectOption('GASOLINA');
  await main.getByLabel(copy.labels.precio).fill('48500000');
}

async function submitCreate(page: Page) {
  await page.getByRole('main').getByRole('button', { name: copy.submitCreate }).click();
}

test.describe('Gestión de vehículos (/admin/vehiculos)', () => {
  test('ASESOR crea un USADO: aparece en el catálogo al instante; ocultarlo lo quita y mostrarlo lo devuelve', async ({
    browser,
  }) => {
    const { context, page } = await sessionFor(browser, (await makeUser('ASESOR')).email);
    const color = uniqueColor();
    try {
      await page.goto('/admin/vehiculos/nuevo');
      await fillVehicle(page, {
        color,
        condicion: 'USADO',
        placa: ` ${plate().toLowerCase()} `,
        km: '12000',
      });
      await submitCreate(page);

      await expect(page).toHaveURL(/\/admin\/vehiculos\/\d+\?creado=1$/);
      await expect(page.getByRole('main').getByText(copy.created)).toBeVisible();

      // Catálogo público: el nuevo aparece sin esperar
      await page.goto(`/catalogo?color=${encodeURIComponent(color)}`);
      await expect(page.getByRole('main').getByRole('article')).toHaveCount(1);

      // Ocultar desde el listado
      await page.goto(`/admin/vehiculos?q=${encodeURIComponent(color)}`);
      const row = page.getByRole('row').filter({ hasText: 'Toyota Corolla' });
      await expect(row).toHaveCount(1);
      await row.getByRole('button', { name: new RegExp(`^${copy.hide}`) }).click();
      await expect(row.getByText(copy.visibleNo)).toBeVisible();
      await page.goto(`/catalogo?color=${encodeURIComponent(color)}`);
      await expect(page.getByRole('main').getByRole('article')).toHaveCount(0);

      // Mostrar de nuevo
      await page.goto(`/admin/vehiculos?q=${encodeURIComponent(color)}`);
      await page
        .getByRole('row')
        .filter({ hasText: 'Toyota Corolla' })
        .getByRole('button', { name: new RegExp(`^${copy.show}`) })
        .click();
      await expect(page.getByRole('row').filter({ hasText: copy.visibleYes })).toHaveCount(1);
      await page.goto(`/catalogo?color=${encodeURIComponent(color)}`);
      await expect(page.getByRole('main').getByRole('article')).toHaveCount(1);
    } finally {
      await context.close();
    }
  });

  test('reglas de placa: USADO sin placa se rechaza, NUEVO sin placa se acepta y la placa duplicada da error de campo', async ({
    browser,
  }) => {
    const { context, page } = await sessionFor(browser, (await makeUser('ASESOR')).email);
    const usedPlate = plate();
    try {
      // USADO sin placa
      await page.goto('/admin/vehiculos/nuevo');
      await fillVehicle(page, { color: uniqueColor(), condicion: 'USADO', placa: '', km: '5' });
      await submitCreate(page);
      await expect(page.getByRole('main').getByText(copy.errors.placaRequired)).toBeVisible();
      await expect(page.getByLabel(copy.labels.placa)).toHaveAttribute('aria-invalid', 'true');

      // NUEVO sin placa, 0 km
      await page.goto('/admin/vehiculos/nuevo');
      await fillVehicle(page, { color: uniqueColor(), condicion: 'NUEVO', placa: '' });
      await submitCreate(page);
      await expect(page).toHaveURL(/\/admin\/vehiculos\/\d+\?creado=1$/);

      // USADO con placa, y luego otro con la misma
      await page.goto('/admin/vehiculos/nuevo');
      await fillVehicle(page, {
        color: uniqueColor(),
        condicion: 'USADO',
        placa: usedPlate,
        km: '10',
      });
      await submitCreate(page);
      await expect(page).toHaveURL(/\/admin\/vehiculos\/\d+\?creado=1$/);

      await page.goto('/admin/vehiculos/nuevo');
      await fillVehicle(page, {
        color: uniqueColor(),
        condicion: 'USADO',
        placa: usedPlate,
        km: '10',
      });
      await submitCreate(page);
      await expect(page.getByRole('main').getByText(copy.errors.placaDuplicate)).toBeVisible();
      await expect(page).toHaveURL(/\/admin\/vehiculos\/nuevo$/);
    } finally {
      await context.close();
    }
  });

  test('vehículo con reserva activa: solo precio y descripción editables, disponibilidad bloqueada y sin ocultar', async ({
    browser,
  }) => {
    const owner = await makeUser('CLIENTE');
    const color = uniqueColor();
    const vehicle = await prisma.vehiculo.create({
      data: {
        modeloId: 1,
        anio: 2020,
        color,
        condicion: Condicion.USADO,
        placa: plate(),
        precio: 50000000,
        disponibilidad: Disponibilidad.RESERVADO,
      },
    });
    await prisma.reserva.create({
      data: {
        codigoReserva: `RES-2026-E${randomBytes(2).toString('hex').toUpperCase().replace(/[01]/g, '2')}`,
        usuarioId: owner.id,
        vehiculoId: vehicle.id,
        estado: EstadoReserva.PENDIENTE_CONTACTO,
      },
    });
    const { context, page } = await sessionFor(browser, (await makeUser('ADMIN')).email);
    try {
      await page.goto(`/admin/vehiculos/${vehicle.id}`);
      const main = page.getByRole('main');
      await expect(main.getByText(copy.lockedReserved)).toBeVisible();
      for (const label of [
        copy.labels.modeloId,
        copy.labels.color,
        copy.labels.condicion,
        copy.labels.disponibilidad,
      ]) {
        await expect(main.getByLabel(label)).toBeDisabled();
      }
      await expect(main.getByLabel(copy.labels.precio)).toBeEnabled();

      // Cambiar el precio sí; lo demás no se toca
      await main.getByLabel(copy.labels.precio).fill('51000000');
      await main.getByRole('button', { name: copy.submitSave }).click();
      await expect(main.getByText(copy.saved)).toBeVisible();
      const after = await prisma.vehiculo.findUniqueOrThrow({ where: { id: vehicle.id } });
      expect(Number(after.precio)).toBe(51000000);
      expect(after.disponibilidad).toBe('RESERVADO');

      // En el listado no se ofrece ocultarlo
      await page.goto(`/admin/vehiculos?q=${encodeURIComponent(color)}`);
      const row = page.getByRole('row').filter({ hasText: 'Toyota Corolla' });
      await expect(row.getByRole('link', { name: new RegExp(copy.edit) })).toBeVisible();
      await expect(row.getByRole('button')).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test('ADMIN crea una marca y un modelo y los usa al crear un vehículo; los duplicados dan error', async ({
    browser,
  }) => {
    const { context, page } = await sessionFor(browser, (await makeUser('ADMIN')).email);
    const brand = `${E2E_BRAND_PREFIX}${randomBytes(3).toString('hex')}`;
    brandNames.push(brand);
    try {
      await page.goto('/admin/vehiculos/marcas');
      const main = page.getByRole('main');
      await main.getByLabel(copy.brands.brandName, { exact: true }).fill(brand);
      await main.getByRole('button', { name: copy.brands.add }).first().click();
      await expect(main.getByRole('heading', { name: new RegExp(brand) })).toBeVisible();

      // Duplicada
      await main.getByLabel(copy.brands.brandName, { exact: true }).fill(brand);
      await main.getByRole('button', { name: copy.brands.add }).first().click();
      await expect(main.getByText(copy.brands.errors.duplicate)).toBeVisible();

      // Modelo (dentro de la sección de su marca)
      const section = main.getByRole('region', { name: new RegExp(brand) });
      await section.getByLabel(`${copy.brands.newModel}: ${brand}`).fill('Prueba 1');
      await section.getByRole('button', { name: copy.brands.add }).click();
      await expect(section.getByText('Prueba 1').first()).toBeVisible();

      // Se ofrece al crear un vehículo
      await page.goto('/admin/vehiculos/nuevo');
      await expect(
        page
          .getByRole('main')
          .getByLabel(copy.labels.modeloId)
          .locator('option', { hasText: `${brand} Prueba 1` })
      ).toHaveCount(1);
    } finally {
      await context.close();
    }
  });

  test('autorización: CLIENTE recibe 404 en todo /admin/vehiculos y el anónimo va a login', async ({
    browser,
    page,
  }) => {
    for (const path of [
      '/admin/vehiculos',
      '/admin/vehiculos/nuevo',
      '/admin/vehiculos/marcas',
      '/admin/vehiculos/1',
    ]) {
      await page.goto(path);
      await expect(page).toHaveURL(
        new RegExp(`/login\\?next=${encodeURIComponent(path).replace(/%/g, '%')}$`)
      );
    }
    const { context, page: clientPage } = await sessionFor(
      browser,
      (await makeUser('CLIENTE')).email
    );
    try {
      for (const path of [
        '/admin/vehiculos',
        '/admin/vehiculos/nuevo',
        '/admin/vehiculos/marcas',
        '/admin/vehiculos/1',
      ]) {
        expect((await clientPage.goto(path))?.status(), path).toBe(404);
      }
    } finally {
      await context.close();
    }
  });

  test('id de vehículo inválido o inexistente en /admin/vehiculos/[id] muestra «no encontrado»', async ({
    browser,
  }) => {
    const { context, page } = await sessionFor(browser, (await makeUser('ASESOR')).email);
    try {
      for (const id of ['abc', '1.5', '0', '4294967295']) {
        await page.goto(`/admin/vehiculos/${id}`);
        await expect(
          page.getByRole('heading', { name: siteContent.errorPages.notFoundTitle })
        ).toBeVisible();
      }
    } finally {
      await context.close();
    }
  });

  test('sin scroll horizontal a 360 px en listado, alta y marcas', async ({ browser }) => {
    const user = await makeUser('ASESOR');
    const context = await browser.newContext({
      viewport: { width: 360, height: 800 },
      extraHTTPHeaders: { 'x-forwarded-for': randomIp() },
    });
    const page = await context.newPage();
    try {
      await page.goto('/login');
      const main = page.getByRole('main');
      await main.getByLabel('Correo electrónico').fill(user.email);
      await main.getByLabel('Contraseña').fill(PASSWORD);
      await main.getByRole('button', { name: 'Iniciar sesión' }).click();
      await expect(page).not.toHaveURL(/\/login/);

      for (const path of [
        '/admin/vehiculos',
        '/admin/vehiculos/nuevo',
        '/admin/vehiculos/marcas',
      ]) {
        await page.goto(path);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - innerWidth
        );
        expect(overflow, path).toBeLessThanOrEqual(0);
      }
    } finally {
      await context.close();
    }
  });
});
