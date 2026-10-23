import { randomBytes, randomInt } from 'node:crypto';
import { test, expect, type Browser, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { hashSync } from 'bcryptjs';
import { siteContent } from '../src/lib/site-content';
import { E2E_EMAIL_DOMAIN } from './test-data';

// Usuarios temporales (`@e2e-test.local`) borrados aunque la prueba falle (y barridos por `global-setup.ts`).
// Cada contexto usa su propia IP en `X-Forwarded-For` (TRUST_PROXY=true).

const PASSWORD = 'Clave-E2E-2026';
const PASSWORD_HASH = hashSync(PASSWORD, 4);
const prisma = new PrismaClient();
const copy = siteContent.adminUsers;

let userIds: number[] = [];

test.afterEach(async () => {
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  userIds = [];
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
      apellido: `Usuaria${tag}`,
      documentoIdentidad: `E2E${tag}`.toUpperCase(),
      email: `e2e-${tag}${E2E_EMAIL_DOMAIN}`,
      passwordHash: PASSWORD_HASH,
      telefono: '573105551234',
    },
  });
  userIds.push(user.id);
  return user;
}

async function loginPage(page: Page, email: string, password: string) {
  await page.goto('/login');
  const main = page.getByRole('main');
  await main.getByLabel('Correo electrónico').fill(email);
  await main.getByLabel('Contraseña').fill(password);
  await main.getByRole('button', { name: 'Iniciar sesión' }).click();
}

async function sessionFor(browser: Browser, email: string, password = PASSWORD) {
  const context = await browser.newContext({ extraHTTPHeaders: { 'x-forwarded-for': randomIp() } });
  const page = await context.newPage();
  await loginPage(page, email, password);
  return { context, page };
}

async function signedIn(browser: Browser, email: string) {
  const session = await sessionFor(browser, email);
  await expect(session.page).not.toHaveURL(/\/login/);
  return session;
}

const rowFor = (page: Page, email: string) =>
  page.getByRole('main').getByRole('row').filter({ hasText: email });

test.describe('Gestión de usuarios (/admin/usuarios)', () => {
  test('restablecer la contraseña: se muestra una sola vez, la temporal sirve y la anterior no', async ({
    browser,
  }) => {
    const target = await makeUser('CLIENTE');
    const admin = await signedIn(browser, (await makeUser('ADMIN')).email);
    try {
      await admin.page.goto(`/admin/usuarios?q=${encodeURIComponent(target.email)}`);
      const row = rowFor(admin.page, target.email);
      await row.getByText(copy.resetPassword).click();
      await row.getByRole('button', { name: copy.resetConfirm }).click();

      const shown = row.getByTestId('temp-password');
      await expect(shown).toBeVisible();
      const temporary = (await shown.innerText()).trim();
      expect(temporary).toHaveLength(16);
      await expect(row.getByText(copy.tempPasswordHelp)).toBeVisible();

      // Solo se muestra una vez: tras recargar ya no está
      await admin.page.reload();
      await expect(admin.page.getByText(temporary)).toHaveCount(0);

      // La anterior ya no sirve…
      const old = await sessionFor(browser, target.email, PASSWORD);
      await expect(
        old.page.getByRole('alert').filter({ hasText: siteContent.auth.invalidCredentials })
      ).toBeVisible();
      await old.context.close();

      // …y la temporal sí
      const fresh = await sessionFor(browser, target.email, temporary);
      await expect(fresh.page).not.toHaveURL(/\/login/);
      await fresh.context.close();
    } finally {
      await admin.context.close();
    }
  });

  test('desactivar impide iniciar sesión y deja sin efecto la sesión abierta; reactivar lo restaura', async ({
    browser,
  }) => {
    const target = await makeUser('CLIENTE', 'Desactivable');
    const admin = await signedIn(browser, (await makeUser('ADMIN')).email);
    const open = await signedIn(browser, target.email);
    try {
      await open.page.goto('/mi-cuenta');
      await expect(open.page.getByRole('heading', { name: 'Mi cuenta', level: 1 })).toBeVisible();

      await admin.page.goto(`/admin/usuarios?q=${encodeURIComponent(target.email)}`);
      const row = rowFor(admin.page, target.email);
      await row.getByRole('button', { name: new RegExp(`^${copy.deactivate}`) }).click();
      await expect(row.getByText(copy.deactivated)).toBeVisible();
      await expect(row.getByText(copy.inactive)).toBeVisible();

      // La sesión que ya estaba abierta no puede seguir usando acciones sensibles
      await open.page.goto('/mi-cuenta');
      await expect(
        open.page.getByRole('heading', { name: siteContent.errorPages.notFoundTitle })
      ).toBeVisible();
      await open.context.close();

      // Y no puede iniciar sesión de nuevo
      const blocked = await sessionFor(browser, target.email);
      await expect(
        blocked.page.getByRole('alert').filter({ hasText: siteContent.auth.invalidCredentials })
      ).toBeVisible();
      await blocked.context.close();

      // Reactivar
      await row.getByRole('button', { name: new RegExp(`^${copy.activate}`) }).click();
      await expect(row.getByText(copy.activated)).toBeVisible();
      const again = await signedIn(browser, target.email);
      await again.context.close();
    } finally {
      await admin.context.close();
    }
  });

  test('cambiar el rol: el usuario entra al panel tras volver a iniciar sesión (el token no se revoca)', async ({
    browser,
  }) => {
    const target = await makeUser('CLIENTE');
    const admin = await signedIn(browser, (await makeUser('ADMIN')).email);
    try {
      await admin.page.goto(`/admin/usuarios?q=${encodeURIComponent(target.email)}`);
      const row = rowFor(admin.page, target.email);
      await row.getByRole('combobox').selectOption('ASESOR');
      await row.getByRole('button', { name: copy.changeRole }).click();
      await expect(row.getByText(copy.roleChanged)).toBeVisible();

      const promoted = await signedIn(browser, target.email);
      try {
        await promoted.page.goto('/admin/reservas');
        await expect(
          promoted.page.getByRole('heading', {
            name: siteContent.admin.sections.reservas,
            level: 1,
          })
        ).toBeVisible();
        // ASESOR: sin Usuarios (404 real)
        expect((await promoted.page.goto('/admin/usuarios'))?.status()).toBe(404);
      } finally {
        await promoted.context.close();
      }
    } finally {
      await admin.context.close();
    }
  });

  test('el administrador no ve acciones sobre su propia fila y no puede quitarse el rol', async ({
    browser,
  }) => {
    const me = await makeUser('ADMIN', 'Yo');
    await makeUser('ADMIN'); // otro ADMIN activo: la salvaguarda que se prueba es la de «uno mismo»
    const admin = await signedIn(browser, me.email);
    try {
      await admin.page.goto(`/admin/usuarios?q=${encodeURIComponent(me.email)}`);
      const row = rowFor(admin.page, me.email);
      await expect(row.getByText(copy.you)).toBeVisible();
      await expect(row.getByRole('button', { name: new RegExp(copy.deactivate) })).toHaveCount(0);
      await expect(row.getByText(copy.resetPassword)).toHaveCount(0);

      await row.getByRole('combobox').selectOption('CLIENTE');
      await row.getByRole('button', { name: copy.changeRole }).click();
      await expect(
        row.getByRole('alert').filter({ hasText: copy.errors.selfForbidden })
      ).toBeVisible();
      expect(
        (await prisma.user.findUniqueOrThrow({ where: { id: me.id }, include: { rol: true } })).rol
          .nombre
      ).toBe('ADMIN');
    } finally {
      await admin.context.close();
    }
  });

  test('la búsqueda filtra, enmascara el documento y no expone la clave; una inyección no devuelve filas', async ({
    browser,
  }) => {
    const target = await makeUser('CLIENTE');
    const admin = await signedIn(browser, (await makeUser('ADMIN')).email);
    try {
      await admin.page.goto(`/admin/usuarios?q=${encodeURIComponent(target.email)}`);
      const row = rowFor(admin.page, target.email);
      await expect(row).toHaveCount(1);
      await expect(row.getByText(target.documentoIdentidad)).toHaveCount(0);
      await expect(
        row.getByText(new RegExp(`^\\*+${target.documentoIdentidad.slice(-3)}$`))
      ).toBeVisible();
      expect(await admin.page.content()).not.toMatch(/\$2[aby]\$/);

      await admin.page.goto(`/admin/usuarios?q=${encodeURIComponent("' OR 1=1 --")}`);
      await expect(admin.page.getByRole('main').getByText(copy.empty)).toBeVisible();
    } finally {
      await admin.context.close();
    }
  });

  test('autorización: ASESOR y CLIENTE reciben 404 y el anónimo va a login', async ({
    browser,
    page,
  }) => {
    await page.goto('/admin/usuarios');
    await expect(page).toHaveURL(/\/login\?next=%2Fadmin%2Fusuarios$/);

    const staff = await signedIn(browser, (await makeUser('ASESOR')).email);
    const client = await signedIn(browser, (await makeUser('CLIENTE')).email);
    try {
      expect((await staff.page.goto('/admin/usuarios'))?.status()).toBe(404);
      expect((await client.page.goto('/admin/usuarios'))?.status()).toBe(404);
      // Tampoco aparece en el menú del ASESOR
      await staff.page.goto('/admin');
      await expect(
        staff.page
          .getByRole('navigation', { name: siteContent.admin.navLabel })
          .getByRole('link', { name: 'Usuarios' })
      ).toHaveCount(0);
    } finally {
      await staff.context.close();
      await client.context.close();
    }
  });

  test('sin scroll horizontal a 360 px', async ({ browser }) => {
    const user = await makeUser('ADMIN');
    const context = await browser.newContext({
      viewport: { width: 360, height: 800 },
      extraHTTPHeaders: { 'x-forwarded-for': randomIp() },
    });
    const page = await context.newPage();
    try {
      await loginPage(page, user.email, PASSWORD);
      await expect(page).not.toHaveURL(/\/login/);
      await page.goto('/admin/usuarios');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
      ).toBeLessThanOrEqual(0);
    } finally {
      await context.close();
    }
  });
});
