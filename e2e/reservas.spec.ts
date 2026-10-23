import { randomBytes, randomInt } from 'node:crypto';
import { test, expect, type Browser, type Page } from '@playwright/test';
import { Condicion, Disponibilidad, EstadoReserva, PrismaClient } from '@prisma/client';
import { hashSync } from 'bcryptjs';
import { siteContent } from '../src/lib/site-content';

// Cada prueba crea sus propios vehículos y usuarios temporales (marcados en `e2e/test-data.ts`), así no toca los
// vehículos del seed ni se pisa con otras pruebas en paralelo; `afterEach` los borra (con sus reservas) aunque
// la prueba falle, y `global-setup.ts` barre cualquier resto de una ejecución interrumpida.
// El servidor de e2e arranca con TRUST_PROXY=true: cada contexto usa su propia IP en `X-Forwarded-For`.

import { E2E_EMAIL_DOMAIN, E2E_VEHICLE_COLOR_PREFIX } from './test-data';

const PASSWORD = 'Clave-E2E-2026';
const PASSWORD_HASH = hashSync(PASSWORD, 4);
const prisma = new PrismaClient();
const copy = siteContent.vehicleDetail;

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

function randomIp(): string {
  return `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`;
}

test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ 'x-forwarded-for': randomIp() });
});

async function makeUser(nombre = 'Reservante') {
  const tag = randomBytes(5).toString('hex');
  const user = await prisma.user.create({
    data: {
      rolId: 1,
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

async function makeVehicle(disponibilidad: Disponibilidad = Disponibilidad.DISPONIBLE) {
  const color = `${E2E_VEHICLE_COLOR_PREFIX}${randomBytes(4).toString('hex')}`;
  const vehicle = await prisma.vehiculo.create({
    data: {
      modeloId: 1, // Toyota Corolla del seed
      anio: 2020,
      color,
      condicion: Condicion.USADO,
      placa: 'E2EPLACA9',
      precio: 50000000,
      disponibilidad,
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
  return { id: vehicle.id, color };
}

async function makeReservation(
  userId: number,
  vehicleId: number,
  estado: EstadoReserva = EstadoReserva.PENDIENTE_CONTACTO
) {
  const code = `RES-2026-${randomBytes(3).toString('hex').toUpperCase().replace(/[01]/g, '2').replace(/[IO]/g, 'K').slice(0, 4).padEnd(4, 'K')}`;
  await prisma.vehiculo.update({
    where: { id: vehicleId },
    data: { disponibilidad: Disponibilidad.RESERVADO },
  });
  return prisma.reserva.create({
    data: { codigoReserva: code, usuarioId: userId, vehiculoId: vehicleId, estado },
  });
}

async function login(page: Page, email: string) {
  await page.goto('/login');
  const main = page.getByRole('main');
  await main.getByLabel('Correo electrónico').fill(email);
  await main.getByLabel('Contraseña').fill(PASSWORD);
  await main.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

const reserveButton = (page: Page) => page.getByRole('button', { name: copy.reserveCta });
const CONFIRMATION_URL = /\/mi-cuenta\/reservas\/RES-\d{4}-[A-Z2-9]{4}\?nueva=1$/;

/** Abre la ficha y espera al botón: antes de hidratar, el clic no enviaría el formulario. */
async function openVehicleAndReserve(page: Page, vehicleId: number) {
  await page.goto(`/vehiculos/${vehicleId}`);
  await expect(reserveButton(page)).toBeVisible();
}

async function newUserPage(browser: Browser, email: string) {
  const context = await browser.newContext({
    extraHTTPHeaders: { 'x-forwarded-for': randomIp() },
  });
  const page = await context.newPage();
  await login(page, email);
  return { context, page };
}

test.describe('Reservas', () => {
  test('flujo completo: reservar → confirmación con WhatsApp → catálogo, ficha y Mis reservas', async ({
    page,
  }) => {
    const user = await makeUser('Camila');
    const vehicle = await makeVehicle();
    await login(page, user.email);

    await openVehicleAndReserve(page, vehicle.id);
    await reserveButton(page).click();

    // Confirmación con el código
    await expect(page).toHaveURL(CONFIRMATION_URL);
    const code = new URL(page.url()).pathname.split('/').pop()!;
    const main = page.getByRole('main');
    await expect(main.getByText(siteContent.cuenta.reservations.newTitle)).toBeVisible();
    await expect(main.getByText(code).first()).toBeVisible();

    // Enlace de WhatsApp: se verifica el href, no se abre WhatsApp
    const whatsapp = main.getByRole('link', { name: siteContent.cuenta.reservations.whatsappCta });
    const href = (await whatsapp.getAttribute('href'))!;
    expect(href).toMatch(/^https:\/\/wa\.me\/\d{10,15}\?text=/);
    const message = decodeURIComponent(href.split('?text=')[1]!);
    expect(message).toContain(code);
    expect(message).toContain('Toyota Corolla');
    expect(message).toContain('Camila');
    expect(message).not.toMatch(/E2EPLACA9|placa/i);

    // La reserva en la BD: pendiente, a 48 h por defecto, y el vehículo reservado
    const row = await prisma.reserva.findUniqueOrThrow({ where: { codigoReserva: code } });
    expect(row).toMatchObject({ usuarioId: user.id, estado: EstadoReserva.PENDIENTE_CONTACTO });
    const hours = (row.fechaExpiracion!.getTime() - row.fechaReserva.getTime()) / 3_600_000;
    expect(Math.round(hours)).toBe(48);

    // Catálogo: el vehículo aparece como RESERVADO
    await page.goto(`/catalogo?color=${encodeURIComponent(vehicle.color)}`);
    await expect(page.getByRole('main').getByRole('article')).toHaveCount(1);
    await expect(page.getByRole('main').getByRole('article').getByText('RESERVADO')).toBeVisible();

    // Ficha: sin botón de reservar y con el estado reservado
    await page.goto(`/vehiculos/${vehicle.id}`);
    await expect(page.getByRole('main').getByText(copy.reservedTitle).first()).toBeVisible();
    await expect(reserveButton(page)).toHaveCount(0);

    // Mis reservas
    await page.goto('/mi-cuenta/reservas');
    const card = page.getByRole('main').getByRole('article');
    await expect(card).toHaveCount(1);
    await expect(card.getByText(code)).toBeVisible();
    await expect(card.getByText('Pendiente de contacto')).toBeVisible();
  });

  test('sin sesión: el botón lleva a iniciar sesión y vuelve a la ficha sin reservar solo', async ({
    page,
  }) => {
    const user = await makeUser();
    const vehicle = await makeVehicle();

    await page.goto(`/vehiculos/${vehicle.id}`);
    await page.getByRole('link', { name: copy.loginToReserveCta }).click();
    await expect(page).toHaveURL(new RegExp(`/login\\?next=%2Fvehiculos%2F${vehicle.id}$`));

    const main = page.getByRole('main');
    await main.getByLabel('Correo electrónico').fill(user.email);
    await main.getByLabel('Contraseña').fill(PASSWORD);
    await main.getByRole('button', { name: 'Iniciar sesión' }).click();

    await expect(page).toHaveURL(new RegExp(`/vehiculos/${vehicle.id}$`));
    await expect(reserveButton(page)).toBeVisible();
    // La reserva siempre exige un clic: volver de iniciar sesión no crea nada
    expect(await prisma.reserva.count({ where: { vehiculoId: vehicle.id } })).toBe(0);
  });

  test('concurrencia: dos usuarios reservan a la vez el mismo vehículo → una sola reserva', async ({
    browser,
  }) => {
    const [a, b] = [await makeUser('Ana'), await makeUser('Beto')];
    const vehicle = await makeVehicle();
    const sessions = [await newUserPage(browser, a.email), await newUserPage(browser, b.email)];

    try {
      for (const { page } of sessions) await openVehicleAndReserve(page, vehicle.id);
      await Promise.all(sessions.map(({ page }) => reserveButton(page).click()));

      // Exactamente una llega a la confirmación
      await expect
        .poll(() => sessions.filter(({ page }) => CONFIRMATION_URL.test(page.url())).length)
        .toBe(1);
      const loser = sessions.find(({ page }) => !CONFIRMATION_URL.test(page.url()))!.page;

      // El que pierde ve la ficha ya en estado reservado, sin botón de reservar
      await expect(reserveButton(loser)).toHaveCount(0);
      await expect(loser.getByRole('main').getByText(copy.reservedTitle).first()).toBeVisible();

      expect(await prisma.reserva.count({ where: { vehiculoId: vehicle.id } })).toBe(1);
      expect(
        (await prisma.vehiculo.findUniqueOrThrow({ where: { id: vehicle.id } })).disponibilidad
      ).toBe(Disponibilidad.RESERVADO);
    } finally {
      await Promise.all(sessions.map(({ context }) => context.close()));
    }
  });

  test('aislamiento: otro usuario no puede abrir la reserva ajena (ni verla en su lista)', async ({
    browser,
  }) => {
    const [owner, other] = [await makeUser('Dueña'), await makeUser('Intruso')];
    const vehicle = await makeVehicle();
    const reservation = await makeReservation(owner.id, vehicle.id);
    const url = `/mi-cuenta/reservas/${reservation.codigoReserva}`;

    const mine = await newUserPage(browser, owner.email);
    const theirs = await newUserPage(browser, other.email);
    try {
      await mine.page.goto(url);
      await expect(
        mine.page.getByRole('main').getByText(reservation.codigoReserva).first()
      ).toBeVisible();

      await theirs.page.goto(url);
      await expect(
        theirs.page.getByRole('heading', { name: siteContent.errorPages.notFoundTitle })
      ).toBeVisible();
      await expect(theirs.page.getByText(reservation.codigoReserva)).toHaveCount(0);

      await theirs.page.goto('/mi-cuenta/reservas');
      await expect(theirs.page.getByRole('main').getByRole('article')).toHaveCount(0);
      await expect(
        theirs.page.getByRole('main').getByText(siteContent.cuenta.reservations.emptyTitle)
      ).toBeVisible();
    } finally {
      await mine.context.close();
      await theirs.context.close();
    }
  });

  test('un código mal formado responde 404', async ({ page }) => {
    const user = await makeUser();
    await login(page, user.email);

    for (const bad of ['RES-1-X', '..%2F', '%3Cscript%3E']) {
      const response = await page.goto(`/mi-cuenta/reservas/${bad}`);
      expect(response?.status(), bad).toBe(404);
    }
  });

  test('tope de reservas activas: la tercera se rechaza con un mensaje y enlace a Mis reservas', async ({
    page,
  }) => {
    const user = await makeUser();
    const [first, second, third] = [await makeVehicle(), await makeVehicle(), await makeVehicle()];
    await makeReservation(user.id, first.id);
    await makeReservation(user.id, second.id);
    await login(page, user.email);

    await openVehicleAndReserve(page, third.id);
    await reserveButton(page).click();

    const alert = page
      .getByRole('alert')
      .filter({ hasText: siteContent.reservations.errors.limitReached });
    await expect(alert).toBeVisible();
    await expect(
      alert.getByRole('link', { name: siteContent.reservations.errors.limitReachedLink })
    ).toHaveAttribute('href', '/mi-cuenta/reservas');
    expect(await prisma.reserva.count({ where: { usuarioId: user.id } })).toBe(2);
    expect(
      (await prisma.vehiculo.findUniqueOrThrow({ where: { id: third.id } })).disponibilidad
    ).toBe(Disponibilidad.DISPONIBLE);
  });

  test('límite de intentos de reserva: tras 10 intentos el siguiente se bloquea', async ({
    page,
  }) => {
    const user = await makeUser();
    const [a, b, target] = [await makeVehicle(), await makeVehicle(), await makeVehicle()];
    await makeReservation(user.id, a.id);
    await makeReservation(user.id, b.id);
    await login(page, user.email);
    await openVehicleAndReserve(page, target.id);

    // Cada intento (aquí rechazado por el tope) consume cupo del usuario: 10 por hora
    for (let attempt = 1; attempt <= 10; attempt++) {
      const response = page.waitForResponse((r) => r.request().method() === 'POST');
      await reserveButton(page).click();
      await response;
      await expect(reserveButton(page)).toBeEnabled();
    }
    await expect(
      page.getByRole('alert').filter({ hasText: siteContent.reservations.errors.limitReached })
    ).toBeVisible();

    const response = page.waitForResponse((r) => r.request().method() === 'POST');
    await reserveButton(page).click();
    await response;
    await expect(
      page.getByRole('alert').filter({ hasText: siteContent.auth.tooManyAttempts })
    ).toBeVisible();
    expect(await prisma.reserva.count({ where: { usuarioId: user.id } })).toBe(2);
  });
});
