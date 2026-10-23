import { randomBytes, randomInt } from 'node:crypto';
import { test, expect, type Browser, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { hashSync } from 'bcryptjs';
import { siteContent } from '../src/lib/site-content';
import { captureBlocked, replay } from './helpers';
import { E2E_EMAIL_DOMAIN } from './test-data';

// Estas pruebas cambian la configuración GLOBAL del sitio: por eso corren en serie dentro de este archivo y
// SIEMPRE restauran los valores originales por la propia interfaz (que invalida la caché), aunque fallen.

test.describe.configure({ mode: 'serial' });

const PASSWORD = 'Clave-E2E-2026';
const PASSWORD_HASH = hashSync(PASSWORD, 4);
const prisma = new PrismaClient();
const copy = siteContent.adminConfig;

let userIds: number[] = [];
let original: Record<string, string> = {};

const randomIp = () => `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`;

test.beforeAll(async () => {
  const rows = await prisma.configuracionConcesionario.findMany({
    where: { clave: { in: ['whatsapp_numero', 'instagram_url'] } },
  });
  original = Object.fromEntries(rows.map((r) => [r.clave, r.valor]));
});

test.afterEach(async () => {
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  userIds = [];
});
test.afterAll(async () => {
  await prisma.$disconnect();
});

test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ 'x-forwarded-for': randomIp() });
});

async function makeUser(rol: 'ADMIN' | 'ASESOR' | 'CLIENTE') {
  const role = await prisma.role.findUniqueOrThrow({ where: { nombre: rol } });
  const tag = randomBytes(5).toString('hex');
  const user = await prisma.user.create({
    data: {
      rolId: role.id,
      nombre: 'Config',
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

function configForm(page: Page, label: string) {
  return page.getByRole('main').getByRole('form', { name: label });
}

async function saveValue(page: Page, label: string, value: string) {
  const form = configForm(page, label);
  await form.getByLabel(copy.newValue).fill(value);
  await form.getByRole('checkbox').check();
  await form.getByRole('button', { name: copy.save }).click();
}

/** Restaura los valores originales por la interfaz (así también se invalida la caché del sitio). */
async function restoreOriginals(browser: Browser) {
  const admin = await makeUser('ADMIN');
  const { context, page } = await sessionFor(browser, admin.email);
  try {
    await page.goto('/admin/configuracion');
    const pairs: [string, string | undefined][] = [
      [copy.keys.whatsapp_numero.label, original.whatsapp_numero],
      [copy.keys.instagram_url.label, original.instagram_url],
    ];
    for (const [label, value] of pairs) {
      if (!value) continue;
      await saveValue(page, label, value);
      await expect(configForm(page, label).getByText(copy.saved)).toBeVisible();
    }
  } finally {
    await context.close();
  }
}

test.describe('Configuración del concesionario (/admin/configuracion)', () => {
  test('cambiar el WhatsApp: vista previa, confirmación y efecto en botón flotante, pie y ficha; luego se restaura', async ({
    browser,
  }) => {
    const { context, page } = await sessionFor(browser, (await makeUser('ADMIN')).email);
    const label = copy.keys.whatsapp_numero.label;
    try {
      await page.goto('/admin/configuracion');
      const form = configForm(page, label);

      // Vista previa del enlace antes de guardar
      await expect(form.getByText(copy.previewInvalid)).toBeVisible();
      await form.getByLabel(copy.newValue).fill('+57 311 222 3344');
      await expect(form.getByTestId('config-whatsapp_numero-preview')).toContainText(
        'https://wa.me/573112223344?text='
      );

      // Sin confirmar no se envía (la casilla es obligatoria)
      await form.getByRole('button', { name: copy.save }).click();
      await expect(form.getByText(copy.saved)).toHaveCount(0);
      expect(
        (
          await prisma.configuracionConcesionario.findUniqueOrThrow({
            where: { clave: 'whatsapp_numero' },
          })
        ).valor
      ).toBe(original.whatsapp_numero);

      await form.getByRole('checkbox').check();
      await form.getByRole('button', { name: copy.save }).click();
      await expect(form.getByText(copy.saved)).toBeVisible();

      // El sitio ya usa el nuevo número, sin reiniciar nada
      await page.goto('/');
      const fab = page
        .getByRole('complementary', { name: 'Canales directos de atención' })
        .getByRole('link', { name: 'Contactar a JDS Vehículos por WhatsApp' });
      await expect(fab).toHaveAttribute('href', /^https:\/\/wa\.me\/573112223344\?text=/);
      await expect(
        page
          .getByRole('banner')
          .getByRole('link', { name: 'Contactar a JDS Vehículos por WhatsApp' })
      ).toHaveAttribute('href', /^https:\/\/wa\.me\/573112223344\?text=/);
      await expect(
        page.getByRole('contentinfo').locator('a[href^="https://wa.me/573112223344"]').first()
      ).toBeVisible();

      await page.goto('/vehiculos/1');
      await expect(
        page.getByRole('main').locator('a[href^="https://wa.me/573112223344"]').first()
      ).toBeVisible();
    } finally {
      await context.close();
      await restoreOriginals(browser);
    }

    // Restaurado
    const check = await browser.newContext({ extraHTTPHeaders: { 'x-forwarded-for': randomIp() } });
    try {
      const page2 = await check.newPage();
      await page2.goto('/');
      await expect(
        page2
          .getByRole('complementary', { name: 'Canales directos de atención' })
          .getByRole('link', { name: 'Contactar a JDS Vehículos por WhatsApp' })
      ).toHaveAttribute('href', new RegExp(`^https://wa\\.me/${original.whatsapp_numero}\\?text=`));
    } finally {
      await check.close();
    }
  });

  test('un número inválido y una URL de otro dominio se rechazan sin guardar', async ({
    browser,
  }) => {
    const { context, page } = await sessionFor(browser, (await makeUser('ADMIN')).email);
    try {
      await page.goto('/admin/configuracion');

      await saveValue(page, copy.keys.whatsapp_numero.label, '12345');
      await expect(
        configForm(page, copy.keys.whatsapp_numero.label)
          .getByRole('alert')
          .filter({ hasText: copy.errors.whatsapp })
      ).toBeVisible();

      for (const bad of [
        'https://facebook.com/jds',
        'https://instagram.com.evil.com/jds',
        'http://www.instagram.com/jds',
      ]) {
        await saveValue(page, copy.keys.instagram_url.label, bad);
        await expect(
          configForm(page, copy.keys.instagram_url.label)
            .getByRole('alert')
            .filter({ hasText: copy.errors.instagram })
        ).toBeVisible();
      }

      const stored = await prisma.configuracionConcesionario.findMany({
        where: { clave: { in: ['whatsapp_numero', 'instagram_url'] } },
      });
      expect(Object.fromEntries(stored.map((r) => [r.clave, r.valor]))).toEqual(original);
    } finally {
      await context.close();
    }
  });

  test('autorización: ASESOR y CLIENTE reciben 404 y el anónimo va a login', async ({
    browser,
    page,
  }) => {
    await page.goto('/admin/configuracion');
    await expect(page).toHaveURL(/\/login\?next=%2Fadmin%2Fconfiguracion$/);

    const staff = await sessionFor(browser, (await makeUser('ASESOR')).email);
    const client = await sessionFor(browser, (await makeUser('CLIENTE')).email);
    try {
      expect((await staff.page.goto('/admin/configuracion'))?.status()).toBe(404);
      expect((await client.page.goto('/admin/configuracion'))?.status()).toBe(404);
    } finally {
      await staff.context.close();
      await client.context.close();
    }
  });

  test('sin scroll horizontal a 360 px', async ({ browser }) => {
    const { context, page } = await sessionFor(browser, (await makeUser('ADMIN')).email, {
      width: 360,
      height: 800,
    });
    try {
      await page.goto('/admin/configuracion');
      await expect(page.getByRole('heading', { name: copy.title, level: 1 })).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
      ).toBeLessThanOrEqual(0);
    } finally {
      await context.close();
    }
  });

  test('la acción de guardar configuración (replay de la petición real del ADMIN): solo ADMIN surte efecto; ASESOR, CLIENTE, anónimo y un ADMIN degradado con sesión vigente no cambian nada', async ({
    browser,
    request,
    baseURL,
  }) => {
    const admin = await sessionFor(browser, (await makeUser('ADMIN')).email);
    const asesor = await sessionFor(browser, (await makeUser('ASESOR')).email);
    const client = await sessionFor(browser, (await makeUser('CLIENTE')).email);
    const degradedUser = await makeUser('ADMIN');
    const degraded = await sessionFor(browser, degradedUser.email);
    const label = copy.keys.instagram_url.label;
    const stored = async () =>
      (
        await prisma.configuracionConcesionario.findUniqueOrThrow({
          where: { clave: 'instagram_url' },
        })
      ).valor;
    const NEW_VALUE = 'https://www.instagram.com/e2e_replay';

    try {
      // Captura (sin que llegue al servidor) la petición real que envía el ADMIN al guardar un valor distinto
      await admin.page.goto('/admin/configuracion');
      const saveRequest = await captureBlocked(admin.page, async () => {
        await saveValue(admin.page, label, NEW_VALUE);
      });
      expect(await stored()).toBe(original.instagram_url);

      // Degradar al segundo ADMIN en la BD: su token sigue siendo de ADMIN
      const asesorRole = await prisma.role.findUniqueOrThrow({ where: { nombre: 'ASESOR' } });
      await prisma.user.update({ where: { id: degradedUser.id }, data: { rolId: asesorRole.id } });

      const attackers: [string, typeof request][] = [
        ['ASESOR', asesor.page.request],
        ['CLIENTE', client.page.request],
        ['anónimo', request],
        ['ADMIN degradado con sesión vigente', degraded.page.request],
      ];
      for (const [who, ctx] of attackers) {
        const response = await replay(ctx, '/admin/reservas', saveRequest, baseURL!);
        expect(response.status(), who).not.toBe(500);
        expect(await stored(), `${who}: la configuración no debe cambiar`).toBe(
          original.instagram_url
        );
      }

      // CONTROL: el mismo replay con la sesión del ADMIN SÍ cambia el valor (el replay es válido)
      const control = await replay(admin.page.request, '/admin/reservas', saveRequest, baseURL!);
      expect(control.status()).toBeLessThan(500);
      await expect.poll(stored).toBe(NEW_VALUE);
    } finally {
      await admin.context.close();
      await asesor.context.close();
      await client.context.close();
      await degraded.context.close();
      await restoreOriginals(browser); // por la interfaz: también invalida la caché del sitio
    }
    expect(await stored()).toBe(original.instagram_url);
  });
});
