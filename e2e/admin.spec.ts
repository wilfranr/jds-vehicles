import { randomBytes, randomInt } from 'node:crypto';
import { test, expect, type APIResponse, type Browser, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { hashSync } from 'bcryptjs';
import { siteContent } from '../src/lib/site-content';
import { E2E_EMAIL_DOMAIN } from './test-data';

// Usuarios temporales (`@e2e-test.local`) con el rol que cada prueba necesita; se borran aunque la prueba falle
// y `global-setup.ts` barre los restos. Cada contexto usa su propia IP en `X-Forwarded-For` (TRUST_PROXY=true).

const PASSWORD = 'Clave-E2E-2026';
const PASSWORD_HASH = hashSync(PASSWORD, 4);
const prisma = new PrismaClient();
const copy = siteContent.admin;

let userIds: number[] = [];

test.afterEach(async () => {
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  userIds = [];
});
test.afterAll(async () => {
  await prisma.$disconnect();
});

function randomIp(): string {
  return `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`;
}

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
      documentoIdentidad: `E2E${tag}`.toUpperCase(),
      email: `e2e-${tag}${E2E_EMAIL_DOMAIN}`,
      passwordHash: PASSWORD_HASH,
      telefono: '573105551234',
    },
  });
  userIds.push(user.id);
  return user;
}

async function login(page: Page, email: string, startAt = '/login') {
  await page.goto(startAt);
  const main = page.getByRole('main');
  await main.getByLabel('Correo electrónico').fill(email);
  await main.getByLabel('Contraseña').fill(PASSWORD);
  await main.getByRole('button', { name: 'Iniciar sesión' }).click();
}

async function sessionFor(browser: Browser, email: string) {
  const context = await browser.newContext({ extraHTTPHeaders: { 'x-forwarded-for': randomIp() } });
  const page = await context.newPage();
  await login(page, email);
  await expect(page).not.toHaveURL(/\/login/);
  return { context, page };
}

/** Sigue a mano hasta 3 redirecciones (Next normaliza `//` con un 308) y devuelve la cadena de respuestas. */
async function followRedirects(
  get: (path: string) => Promise<APIResponse>,
  path: string
): Promise<APIResponse[]> {
  const chain: APIResponse[] = [];
  let next: string | null = path;
  for (let hop = 0; hop < 3 && next; hop++) {
    const response = await get(next);
    chain.push(response);
    const location = response.headers()['location'];
    next =
      [307, 308].includes(response.status()) && location
        ? new URL(location, 'http://x').pathname + new URL(location, 'http://x').search
        : null;
  }
  return chain;
}

const ADMIN_VARIANTS = ['/%61dmin/x', '/admin%2fx', '/ADMIN/x', '/admin//x', '/admin/../admin/x'];

test.describe('Panel /admin', () => {
  test('anónimo: /admin lleva a login con next y, tras entrar un ASESOR, vuelve al Resumen', async ({
    page,
  }) => {
    const asesor = await makeUser('ASESOR');
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login\?next=%2Fadmin$/);

    await login(page, asesor.email, '/login?next=%2Fadmin');
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole('heading', { name: copy.dashboard.title, level: 1 })).toBeVisible();
  });

  test('ASESOR: ve el Resumen y sus secciones, no Usuarios ni Configuración (404)', async ({
    browser,
  }) => {
    const { context, page } = await sessionFor(browser, (await makeUser('ASESOR')).email);
    try {
      await page.goto('/admin');
      await expect(
        page.getByRole('heading', { name: copy.dashboard.title, level: 1 })
      ).toBeVisible();
      await expect(
        page.getByRole('main').getByText(copy.dashboard.vehicleLabels.DISPONIBLE)
      ).toBeVisible();
      await expect(
        page.getByRole('main').getByText(copy.dashboard.activeReservations)
      ).toBeVisible();
      // Los usuarios activos son solo de ADMIN
      await expect(page.getByText(copy.dashboard.activeUsers)).toHaveCount(0);

      const nav = page.getByRole('navigation', { name: copy.navLabel });
      for (const name of ['Resumen', 'Reservas', 'Ventas', 'Vehículos']) {
        await expect(nav.getByRole('link', { name })).toBeVisible();
      }
      await expect(nav.getByRole('link', { name: 'Usuarios' })).toHaveCount(0);
      await expect(nav.getByRole('link', { name: 'Configuración' })).toHaveCount(0);

      for (const path of ['/admin/usuarios', '/admin/configuracion']) {
        expect((await page.goto(path))?.status(), path).toBe(404);
      }
      // Las secciones de personal sí abren
      expect((await page.goto('/admin/reservas'))?.status()).toBe(200);
    } finally {
      await context.close();
    }
  });

  test('ADMIN: ve Usuarios y Configuración y el contador de usuarios activos', async ({
    browser,
  }) => {
    const { context, page } = await sessionFor(browser, (await makeUser('ADMIN')).email);
    try {
      await page.goto('/admin');
      await expect(page.getByRole('main').getByText(copy.dashboard.activeUsers)).toBeVisible();
      const nav = page.getByRole('navigation', { name: copy.navLabel });
      await expect(nav.getByRole('link', { name: 'Usuarios' })).toBeVisible();
      await expect(nav.getByRole('link', { name: 'Configuración' })).toBeVisible();

      await nav.getByRole('link', { name: 'Usuarios' }).click();
      await expect(page).toHaveURL(/\/admin\/usuarios$/);
      await expect(
        page.getByRole('heading', { name: copy.sections.usuarios, level: 1 })
      ).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('CLIENTE: /admin responde 404 y el menú de usuario no ofrece el panel', async ({
    browser,
  }) => {
    const { context, page } = await sessionFor(browser, (await makeUser('CLIENTE')).email);
    try {
      expect((await page.goto('/admin'))?.status()).toBe(404);
      expect((await page.goto('/admin/usuarios'))?.status()).toBe(404);

      await page.goto('/');
      await page
        .getByRole('banner')
        .getByRole('button', { name: /Personal/ })
        .first()
        .click();
      await expect(page.getByRole('menuitem', { name: 'Mi cuenta' })).toBeVisible();
      await expect(
        page.getByRole('menuitem', { name: siteContent.account.adminPanel })
      ).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test('el menú de usuario de un ASESOR ofrece «Panel del concesionario»', async ({ browser }) => {
    const { context, page } = await sessionFor(browser, (await makeUser('ASESOR')).email);
    try {
      await page.goto('/');
      await page
        .getByRole('banner')
        .getByRole('button', { name: /Personal/ })
        .first()
        .click();
      await page.getByRole('menuitem', { name: siteContent.account.adminPanel }).click();
      await expect(page).toHaveURL(/\/admin$/);
    } finally {
      await context.close();
    }
  });

  test('un usuario desactivado con sesión abierta pierde el acceso al panel', async ({
    browser,
  }) => {
    const user = await makeUser('ASESOR');
    const { context, page } = await sessionFor(browser, user.email);
    try {
      await page.goto('/admin');
      await expect(
        page.getByRole('heading', { name: copy.dashboard.title, level: 1 })
      ).toBeVisible();

      await prisma.user.update({ where: { id: user.id }, data: { activo: false } });
      // La comprobación con la BD ocurre en la página (en streaming): se ve «no encontrado», sin contenido del panel.
      await page.goto('/admin');
      await expect(
        page.getByRole('heading', { name: siteContent.errorPages.notFoundTitle })
      ).toBeVisible();
      await expect(page.getByText(copy.dashboard.vehiclesHeading)).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test('cerrar sesión desde el panel vuelve a la portada', async ({ browser }) => {
    const { context, page } = await sessionFor(browser, (await makeUser('ADMIN')).email);
    try {
      await page.goto('/admin');
      await page.getByRole('button', { name: siteContent.account.logout }).click();
      await expect(page).toHaveURL(/\/$/);
      expect((await page.goto('/admin'))?.url()).toMatch(/\/login\?next=%2Fadmin$/);
    } finally {
      await context.close();
    }
  });

  test.describe('variantes de ruta no eluden el proxy ni dan contenido', () => {
    test('anónimo: acaba en login o en 404, nunca en contenido', async ({ request }) => {
      for (const path of ADMIN_VARIANTS) {
        const chain = await followRedirects((p) => request.get(p, { maxRedirects: 0 }), path);
        const last = chain[chain.length - 1]!;
        // Termina en 404 o en una redirección a login (la cadena puede incluir antes la normalización 308 de `//`)
        const ends =
          last.status() === 404 ||
          chain.some(
            (r) => r.status() === 307 && (r.headers()['location'] ?? '').includes('/login')
          );
        expect(ends, `${path} → ${chain.map((r) => r.status()).join(' → ')}`).toBe(true);
        for (const response of chain) {
          expect(await response.text(), path).not.toContain(copy.dashboard.vehiclesHeading);
        }
      }
    });

    test('CLIENTE: acaba en 404, nunca en contenido del panel', async ({ browser }) => {
      const { context, page } = await sessionFor(browser, (await makeUser('CLIENTE')).email);
      try {
        for (const path of ['/admin', '/admin/x', ...ADMIN_VARIANTS]) {
          const chain = await followRedirects(
            (p) => page.request.get(p, { maxRedirects: 0 }),
            path
          );
          const last = chain[chain.length - 1]!;
          expect(last.status(), `${path} → ${chain.map((r) => r.status()).join(' → ')}`).toBe(404);
          for (const response of chain) {
            expect(await response.text(), path).not.toContain(copy.dashboard.vehiclesHeading);
          }
        }
      } finally {
        await context.close();
      }
    });
  });

  test('sin scroll horizontal a 360 px', async ({ browser }) => {
    const user = await makeUser('ADMIN');
    const context = await browser.newContext({
      viewport: { width: 360, height: 800 },
      extraHTTPHeaders: { 'x-forwarded-for': randomIp() },
    });
    const page = await context.newPage();
    try {
      await login(page, user.email);
      await expect(page).not.toHaveURL(/\/login/);
      await page.goto('/admin');
      await expect(
        page.getByRole('heading', { name: copy.dashboard.title, level: 1 })
      ).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
      ).toBeLessThanOrEqual(0);
    } finally {
      await context.close();
    }
  });
});
