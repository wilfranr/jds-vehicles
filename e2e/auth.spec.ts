import { randomBytes, randomInt } from 'node:crypto';
import { test, expect, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { siteContent } from '../src/lib/site-content';

// El servidor de e2e arranca con TRUST_PROXY=true (ver playwright.config.ts): cada prueba usa su propia IP
// en `X-Forwarded-For`, así los limitadores (registro 5/hora, login 5 por correo+IP) no se afectan entre
// pruebas ni entre ejecuciones, y no hace falta exponer ningún reinicio del limitador.

const DEMO_EMAIL = 'carlos.gomez@example.com';
const DEMO_PASSWORD = 'Cliente123*';
const PASSWORD = 'Clave-E2E-2026';

const prisma = new PrismaClient();
const createdEmails: string[] = [];

// Cada worker borra los usuarios que creó. El conteo global de `usuarios` antes/después de la ejecución
// completa se comprueba en `global-setup.ts` (los workers corren en paralelo y no pueden compararlo por separado).
test.afterAll(async () => {
  if (createdEmails.length > 0) {
    await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
  }
  const left = await prisma.user.count({ where: { email: { in: createdEmails } } });
  await prisma.$disconnect();
  expect(left, 'las pruebas no deben dejar usuarios residuales').toBe(0);
});

test.beforeEach(async ({ context }) => {
  const ip = `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`;
  await context.setExtraHTTPHeaders({ 'x-forwarded-for': ip });
});

function uniqueEmail(): string {
  const email = `e2e-${randomBytes(5).toString('hex')}@example.com`;
  createdEmails.push(email);
  return email;
}

async function register(page: Page, email: string) {
  await page.goto('/registro');
  const form = page.getByRole('main');
  await form.getByLabel('Nombres').fill('Prueba');
  await form.getByLabel('Apellidos').fill('Automática');
  await form.getByLabel('Tipo de documento').selectOption('CC');
  await form.getByLabel('Número de documento').fill(String(randomInt(1e9, 9e9)));
  await form.getByLabel('Correo electrónico').fill(email);
  await form.getByLabel('Celular').fill('3105551234');
  await form.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
  await form.getByLabel('Confirmar contraseña').fill(PASSWORD);
  await form.getByRole('checkbox').check();
  await form.getByRole('button', { name: 'Crear cuenta' }).click();
}

async function login(page: Page, email: string, password: string) {
  const main = page.getByRole('main');
  await main.getByLabel('Correo electrónico').fill(email);
  await main.getByLabel('Contraseña').fill(password);
  await main.getByRole('button', { name: 'Iniciar sesión' }).click();
}

test.describe('Autenticación', () => {
  test('registro → sesión → mi cuenta → cerrar sesión', async ({ page }) => {
    await register(page, uniqueEmail());

    const banner = page.getByRole('banner');
    await expect(banner.getByRole('button', { name: /Prueba/ }).first()).toBeVisible();

    await page.goto('/mi-cuenta');
    await expect(page.getByRole('heading', { name: 'Mi cuenta', level: 1 })).toBeVisible();

    await banner
      .getByRole('button', { name: /Prueba/ })
      .first()
      .click();
    await page.getByRole('menuitem', { name: 'Cerrar sesión' }).click();
    await expect(banner.getByRole('link', { name: 'Iniciar sesión' }).first()).toBeVisible();
  });

  test('login incorrecto: mismo mensaje con correo inexistente y con contraseña errónea', async ({
    page,
  }) => {
    const message = page
      .getByRole('alert')
      .filter({ hasText: siteContent.auth.invalidCredentials });

    await page.goto('/login');
    await login(page, `no-existe-${randomBytes(4).toString('hex')}@example.com`, 'Cualquier-1234');
    await expect(message).toBeVisible();
    const unknownUser = await message.innerText();

    await page.goto('/login');
    await login(page, DEMO_EMAIL, 'Contraseña-Errónea-1');
    await expect(message).toBeVisible();
    expect(await message.innerText()).toBe(unknownUser);
  });

  test('ruta protegida: redirige a login y vuelve tras iniciar sesión', async ({ page }) => {
    await page.goto('/mi-cuenta');
    await expect(page).toHaveURL(/\/login\?next=%2Fmi-cuenta$/);

    await login(page, DEMO_EMAIL, DEMO_PASSWORD);
    await expect(page).toHaveURL(/\/mi-cuenta$/);
    await expect(page.getByRole('heading', { name: 'Mi cuenta', level: 1 })).toBeVisible();
  });

  for (const hostile of ['//evil.com', 'https://evil.com', '/\\evil.com']) {
    test(`next hostil (${hostile}) termina en el propio sitio`, async ({ page, baseURL }) => {
      await page.goto(`/login?next=${encodeURIComponent(hostile)}`);
      await login(page, DEMO_EMAIL, DEMO_PASSWORD);
      await expect(page).toHaveURL(`${baseURL}/`);
    });
  }

  test('un CLIENTE no accede a /admin (404)', async ({ page }) => {
    await page.goto('/login');
    await login(page, DEMO_EMAIL, DEMO_PASSWORD);
    await expect(page).toHaveURL(/\/$/);

    const response = await page.goto('/admin');
    expect(response?.status()).toBe(404);
  });

  test('sin sesión, el detalle de un vehículo ofrece iniciar sesión para reservar', async ({
    page,
  }) => {
    await page.goto('/vehiculos/1');
    await page.getByRole('link', { name: siteContent.vehicleDetail.loginToReserveCta }).click();
    await expect(page).toHaveURL(/\/login\?next=%2Fvehiculos%2F1$/);
  });

  test('límite de intentos: el sexto fallo seguido muestra "Demasiados intentos"', async ({
    page,
  }) => {
    const email = uniqueEmail(); // no existe; solo importa el contador de correo+IP
    await page.goto('/login');
    for (let i = 0; i < 5; i++) {
      // Se espera la respuesta de cada envío: el mensaje de error del intento anterior ya es visible.
      const response = page.waitForResponse((r) => r.request().method() === 'POST');
      await login(page, email, `Incorrecta-${i}-Clave`);
      await response;
      // React reinicia el formulario al terminar la acción: hay que esperarlo antes del siguiente envío,
      // o el reinicio borra lo escrito.
      await expect(page.getByRole('main').getByLabel('Contraseña')).toHaveValue('');
    }
    await expect(
      page.getByRole('alert').filter({ hasText: siteContent.auth.invalidCredentials })
    ).toBeVisible();
    await login(page, email, 'Incorrecta-6-Clave');
    await expect(
      page.getByRole('alert').filter({ hasText: siteContent.auth.tooManyAttempts })
    ).toBeVisible();
  });

  test('cambio de contraseña: cerrar sesión y entrar con la nueva', async ({ page }) => {
    const email = uniqueEmail();
    const newPassword = 'Otra-Clave-E2E-77';
    await register(page, email);
    await expect(
      page
        .getByRole('banner')
        .getByRole('button', { name: /Prueba/ })
        .first()
    ).toBeVisible();

    await page.goto('/mi-cuenta/seguridad');
    await page.getByLabel('Contraseña actual').fill(PASSWORD);
    await page.getByLabel('Contraseña nueva', { exact: true }).fill(newPassword);
    await page.getByLabel('Confirmar contraseña nueva').fill(newPassword);
    await page.getByRole('button', { name: 'Cambiar contraseña' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'se cambió' })).toBeVisible();

    await page.context().clearCookies();
    await page.goto('/login');
    await login(page, email, PASSWORD);
    await expect(
      page.getByRole('alert').filter({ hasText: siteContent.auth.invalidCredentials })
    ).toBeVisible();

    await login(page, email, newPassword);
    await expect(page).toHaveURL(/\/$/);
    await expect(
      page
        .getByRole('banner')
        .getByRole('button', { name: /Prueba/ })
        .first()
    ).toBeVisible();
  });
});
