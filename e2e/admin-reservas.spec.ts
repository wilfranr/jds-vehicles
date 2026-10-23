import { randomBytes, randomInt } from 'node:crypto';
import { test, expect, type Browser } from '@playwright/test';
import { Condicion, Disponibilidad, EstadoReserva, PrismaClient } from '@prisma/client';
import { hashSync } from 'bcryptjs';
import { siteContent } from '../src/lib/site-content';
import { E2E_EMAIL_DOMAIN, E2E_VEHICLE_COLOR_PREFIX } from './test-data';

// Datos temporales marcados (`@e2e-test.local`, color `E2E-RESERVAS-…`) que cada prueba borra aunque falle y que
// `global-setup.ts` barre. Cada contexto usa su propia IP en `X-Forwarded-For` (TRUST_PROXY=true).

const PASSWORD = 'Clave-E2E-2026';
const PASSWORD_HASH = hashSync(PASSWORD, 4);
const prisma = new PrismaClient();
const copy = siteContent.adminReservations;
const statusLabels = siteContent.cuenta.reservations.statusLabels;

let userIds: number[] = [];
let vehicleIds: number[] = [];

test.afterEach(async () => {
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

async function makeUser(rol: 'ADMIN' | 'ASESOR' | 'CLIENTE', nombre = 'Personal') {
  const role = await prisma.role.findUniqueOrThrow({ where: { nombre: rol } });
  const tag = randomBytes(5).toString('hex');
  const user = await prisma.user.create({
    data: {
      rolId: role.id,
      nombre,
      apellido: 'Automática',
      documentoIdentidad: `7${randomInt(1e9, 9e9)}`,
      email: `e2e-${tag}${E2E_EMAIL_DOMAIN}`,
      passwordHash: PASSWORD_HASH,
      telefono: '573105557777',
      ciudad: 'Pereira',
    },
  });
  userIds.push(user.id);
  return user;
}

async function makeReservation(estado: EstadoReserva = EstadoReserva.PENDIENTE_CONTACTO) {
  const client = await makeUser('CLIENTE', 'Clienta');
  const color = `${E2E_VEHICLE_COLOR_PREFIX}res-${randomBytes(4).toString('hex')}`;
  const vehicle = await prisma.vehiculo.create({
    data: {
      modeloId: 1, // Toyota Corolla del seed
      anio: 2020,
      color,
      condicion: Condicion.USADO,
      placa: `R${randomBytes(3).toString('hex').toUpperCase()}`,
      precio: 50000000,
      disponibilidad: Disponibilidad.RESERVADO,
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
  const code = `RES-2026-E${randomBytes(2).toString('hex').toUpperCase().replace(/[01]/g, '2').slice(0, 3)}`;
  await prisma.reserva.create({
    data: { codigoReserva: code, usuarioId: client.id, vehiculoId: vehicle.id, estado },
  });
  return { code, color, vehicle, client };
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

test.describe('Gestión de reservas (/admin/reservas)', () => {
  test('el detalle muestra los datos del cliente con el documento enmascarado y el enlace de WhatsApp al cliente', async ({
    browser,
  }) => {
    const { code, client } = await makeReservation();
    const { context, page } = await sessionFor(browser, (await makeUser('ASESOR')).email);
    try {
      await page.goto(`/admin/reservas/${code}`);
      const main = page.getByRole('main');
      await expect(main.getByRole('heading', { name: code, level: 1 })).toBeVisible();
      await expect(main.getByText(client.email)).toBeVisible();
      await expect(main.getByText('573105557777')).toBeVisible();
      await expect(main.getByText('Pereira')).toBeVisible();
      await expect(main.getByText(statusLabels.PENDIENTE_CONTACTO)).toBeVisible();

      // Documento enmascarado: solo se ven los 3 últimos caracteres
      await expect(
        main.getByText(new RegExp(`^\\*+${client.documentoIdentidad.slice(-3)}$`))
      ).toBeVisible();
      await expect(main.getByText(client.documentoIdentidad)).toHaveCount(0);
      // La placa completa sí (es el personal)
      await expect(main.getByText(/^R[0-9A-F]{6}$/)).toBeVisible();

      const href = await main.getByRole('link', { name: copy.contactClient }).getAttribute('href');
      expect(href).toMatch(/^https:\/\/wa\.me\/573105557777\?text=/);
      expect(decodeURIComponent(href!.split('?text=')[1]!)).toContain(code);
    } finally {
      await context.close();
    }
  });

  test('ASESOR inicia la negociación y luego cancela con motivo: el vehículo vuelve al catálogo al instante', async ({
    browser,
  }) => {
    const { code, color } = await makeReservation();
    const { context, page } = await sessionFor(browser, (await makeUser('ASESOR')).email);
    try {
      // El vehículo reservado no es «disponible»: su ficha lo muestra reservado
      await page.goto(`/admin/reservas/${code}`);
      const main = page.getByRole('main');

      await main.getByRole('button', { name: copy.startNegotiation }).click();
      await expect(main.getByText(copy.negotiationStarted)).toBeVisible();
      await expect(main.getByText(statusLabels.EN_NEGOCIACION).first()).toBeVisible();
      await expect(main.getByRole('button', { name: copy.startNegotiation })).toHaveCount(0);

      await main.getByText(copy.cancelReservation).click();
      await main.getByLabel(copy.cancelReasonLabel).fill('El cliente desistió');
      await main.getByRole('button', { name: copy.cancelConfirm }).click();
      await expect(main.getByText(copy.cancelled)).toBeVisible();
      await expect(main.getByText(statusLabels.CANCELADA).first()).toBeVisible();
      await expect(main.getByText(copy.finalState)).toBeVisible();

      const row = await prisma.reserva.findUniqueOrThrow({ where: { codigoReserva: code } });
      expect(row.estado).toBe('CANCELADA');
      expect(row.observaciones).toBe('Cancelación: El cliente desistió');

      // El catálogo ya lo muestra (sin esperar la caducidad de la caché)
      await page.goto(`/catalogo?color=${encodeURIComponent(color)}`);
      await expect(page.getByRole('main').getByRole('article')).toHaveCount(1);
    } finally {
      await context.close();
    }
  });

  test('dos personas cancelando a la vez: una cancela y la otra ve un aviso claro', async ({
    browser,
  }) => {
    const { code } = await makeReservation();
    const a = await sessionFor(browser, (await makeUser('ASESOR')).email);
    const b = await sessionFor(browser, (await makeUser('ADMIN')).email);
    try {
      for (const { page } of [a, b]) {
        await page.goto(`/admin/reservas/${code}`);
        await page.getByRole('main').getByText(copy.cancelReservation).click();
        await expect(
          page.getByRole('main').getByRole('button', { name: copy.cancelConfirm })
        ).toBeVisible();
      }
      await Promise.all(
        [a, b].map(({ page }) =>
          page.getByRole('main').getByRole('button', { name: copy.cancelConfirm }).click()
        )
      );

      const ok = [a, b].map(({ page }) => page.getByRole('main').getByText(copy.cancelled));
      const warn = [a, b].map(({ page }) =>
        page.getByRole('main').getByRole('alert').filter({ hasText: copy.errors.invalidTransition })
      );
      await expect.poll(async () => (await ok[0]!.count()) + (await ok[1]!.count())).toBe(1);
      await expect.poll(async () => (await warn[0]!.count()) + (await warn[1]!.count())).toBe(1);

      expect(
        (await prisma.reserva.findUniqueOrThrow({ where: { codigoReserva: code } })).estado
      ).toBe('CANCELADA');
    } finally {
      await a.context.close();
      await b.context.close();
    }
  });

  test('las observaciones se guardan y el HTML se muestra como texto (sin ejecutarse)', async ({
    browser,
  }) => {
    const { code } = await makeReservation();
    const { context, page } = await sessionFor(browser, (await makeUser('ASESOR')).email);
    const hostile = '<img src=x onerror=alert(1)> <b>negrita</b>';
    try {
      await page.goto(`/admin/reservas/${code}`);
      const main = page.getByRole('main');
      await main.getByLabel(copy.notesLabel).fill(hostile);
      await main.getByRole('button', { name: copy.notesSave }).click();
      await expect(main.getByText(copy.notesSaved)).toBeVisible();

      await page.reload();
      await expect(page.getByRole('main').getByLabel(copy.notesLabel)).toHaveValue(hostile);
      await expect(page.locator('main img[src="x"]')).toHaveCount(0);
      await expect(page.locator('main b')).toHaveCount(0);

      // Más de 1000 caracteres se rechaza con un aviso
      await main.getByLabel(copy.notesLabel).fill('x'.repeat(1100));
      await main.getByRole('button', { name: copy.notesSave }).click();
      await expect(main.getByRole('alert').filter({ hasText: copy.notesTooLong })).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('el listado muestra las activas primero y filtra por estado y por búsqueda', async ({
    browser,
  }) => {
    const active = await makeReservation();
    const cancelled = await makeReservation(EstadoReserva.CANCELADA);
    const { context, page } = await sessionFor(browser, (await makeUser('ADMIN')).email);
    try {
      await page.goto(`/admin/reservas?q=${encodeURIComponent(active.client.email)}`);
      const rows = page.getByRole('main').getByRole('row');
      await expect(rows.filter({ hasText: active.code })).toHaveCount(1);
      await expect(rows.filter({ hasText: cancelled.code })).toHaveCount(0);

      await page.goto(`/admin/reservas?q=${cancelled.code}&estado=CANCELADA`);
      await expect(
        page.getByRole('main').getByRole('row').filter({ hasText: cancelled.code })
      ).toHaveCount(1);

      // Una cadena de inyección no rompe nada ni devuelve filas
      await page.goto(`/admin/reservas?q=${encodeURIComponent("' OR 1=1 --")}`);
      await expect(page.getByRole('main').getByText(copy.empty)).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('autorización: CLIENTE recibe 404 y el anónimo va a login; un código mal formado es 404', async ({
    browser,
    page,
  }) => {
    const { code } = await makeReservation();
    for (const path of ['/admin/reservas', `/admin/reservas/${code}`]) {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(path)}$`));
    }
    const client = await sessionFor(browser, (await makeUser('CLIENTE')).email);
    const staff = await sessionFor(browser, (await makeUser('ASESOR')).email);
    try {
      for (const path of ['/admin/reservas', `/admin/reservas/${code}`]) {
        expect((await client.page.goto(path))?.status(), path).toBe(404);
      }
      await staff.page.goto('/admin/reservas/RES-1-X');
      await expect(
        staff.page.getByRole('heading', { name: siteContent.errorPages.notFoundTitle })
      ).toBeVisible();
      await staff.page.goto('/admin/reservas/RES-2026-ZZZZ');
      await expect(
        staff.page.getByRole('heading', { name: siteContent.errorPages.notFoundTitle })
      ).toBeVisible();
    } finally {
      await client.context.close();
      await staff.context.close();
    }
  });

  test('sin scroll horizontal a 360 px en listado y detalle', async ({ browser }) => {
    const { code } = await makeReservation();
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

      for (const path of ['/admin/reservas', `/admin/reservas/${code}`]) {
        await page.goto(path);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
          path
        ).toBeLessThanOrEqual(0);
      }
    } finally {
      await context.close();
    }
  });
});
