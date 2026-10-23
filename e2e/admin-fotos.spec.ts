import { randomBytes, randomInt } from 'node:crypto';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { test, expect, type Browser, type Page } from '@playwright/test';
import { Condicion, PrismaClient } from '@prisma/client';
import { hashSync } from 'bcryptjs';
import sharp from 'sharp';
import { siteContent } from '../src/lib/site-content';
import { E2E_EMAIL_DOMAIN, E2E_UPLOADS_DIR, E2E_VEHICLE_COLOR_PREFIX } from './test-data';

// Cada prueba crea sus propios vehículos y usuarios temporales y, al terminar (aunque falle), borra las filas Y
// los archivos de fotos que el servidor escribió en `UPLOADS_DIR` (`.e2e-uploads`). `global-setup.ts` comprueba
// que no queda nada. Nunca se abre «la primera tarjeta» del catálogo: se filtra por el color único del vehículo.

const PASSWORD = 'Clave-E2E-2026';
const PASSWORD_HASH = hashSync(PASSWORD, 4);
const prisma = new PrismaClient();
const copy = siteContent.adminPhotos;
const UUID_URL = /^\/media\/([0-9a-f-]{36})\.webp$/;

let userIds: number[] = [];
let vehicleIds: number[] = [];

/** Borra los archivos de las fotos de los vehículos de la prueba (las filas caen con el vehículo). */
async function removeUploadedFiles(ids: number[]) {
  const photos = await prisma.vehiculoFoto.findMany({
    where: { vehiculoId: { in: ids } },
    select: { urlFoto: true },
  });
  for (const { urlFoto } of photos) {
    const match = UUID_URL.exec(urlFoto);
    if (!match) continue;
    for (const name of [`${match[1]}.webp`, `${match[1]}_t.webp`]) {
      await rm(path.join(E2E_UPLOADS_DIR, name), { force: true });
    }
  }
}

test.afterEach(async () => {
  await removeUploadedFiles(vehicleIds);
  await prisma.reserva.deleteMany({ where: { vehiculoId: { in: vehicleIds } } });
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

async function makeUser(rol: 'ADMIN' | 'ASESOR' | 'CLIENTE') {
  const role = await prisma.role.findUniqueOrThrow({ where: { nombre: rol } });
  const tag = randomBytes(5).toString('hex');
  const user = await prisma.user.create({
    data: {
      rolId: role.id,
      nombre: 'Fotos',
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

async function makeVehicle() {
  const color = `${E2E_VEHICLE_COLOR_PREFIX}foto-${randomBytes(4).toString('hex')}`;
  const vehicle = await prisma.vehiculo.create({
    data: {
      modeloId: 1,
      anio: 2023,
      color,
      condicion: Condicion.NUEVO,
      precio: 60000000,
    },
  });
  vehicleIds.push(vehicle.id);
  return { id: vehicle.id, color };
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

const image = {
  png: (color = '#cc3333') =>
    sharp({ create: { width: 640, height: 400, channels: 3, background: color } })
      .png()
      .toBuffer(),
  jpeg: (color = '#33cc33') =>
    sharp({ create: { width: 800, height: 500, channels: 3, background: color } })
      .jpeg()
      .toBuffer(),
  webp: (color = '#3333cc') =>
    sharp({ create: { width: 700, height: 450, channels: 3, background: color } })
      .webp()
      .toBuffer(),
  jpegWithExif: () =>
    sharp({ create: { width: 640, height: 400, channels: 3, background: '#999999' } })
      .jpeg()
      .withExif({ IFD0: { Copyright: 'SECRETO-GPS-E2E' } })
      .toBuffer(),
};

function file(name: string, mimeType: string, buffer: Buffer) {
  return { name, mimeType, buffer };
}

async function upload(page: Page, files: ReturnType<typeof file>[]) {
  const main = page.getByRole('main');
  await main.getByLabel(copy.uploadLabel).setInputFiles(files);
  await main.getByRole('button', { name: copy.uploadSubmit }).click();
}

const photoItems = (page: Page) =>
  page.getByRole('main').getByRole('list', { name: copy.listLabel }).getByRole('listitem');
const dbPhotos = (vehicleId: number) =>
  prisma.vehiculoFoto.findMany({
    where: { vehiculoId: vehicleId },
    orderBy: [{ ordenPresentacion: 'asc' }, { id: 'asc' }],
  });

test.describe('Fotos de vehículos (/admin/vehiculos/[id])', () => {
  test('subir 3 fotos, marcar la segunda principal y reordenar se refleja en la ficha pública y el catálogo', async ({
    browser,
  }) => {
    const vehicle = await makeVehicle();
    const { context, page } = await sessionFor(browser, (await makeUser('ASESOR')).email);
    try {
      await page.goto(`/admin/vehiculos/${vehicle.id}`);
      await upload(page, [
        file('uno.png', 'image/png', await image.png()),
        file('dos.jpg', 'image/jpeg', await image.jpeg()),
        file('tres.webp', 'image/webp', await image.webp()),
      ]);

      await expect(page.getByRole('main').getByText('Se subieron 3 fotografías.')).toBeVisible();
      await expect(photoItems(page)).toHaveCount(3);
      let photos = await dbPhotos(vehicle.id);
      expect(photos.map((p) => p.esPrincipal)).toEqual([true, false, false]);
      for (const p of photos) expect(p.urlFoto).toMatch(UUID_URL);

      // Marcar la segunda como principal
      const second = photoItems(page).nth(1);
      await second.getByRole('button', { name: copy.makePrincipal }).click();
      await expect(second.getByText(copy.principal, { exact: true })).toBeVisible();
      photos = await dbPhotos(vehicle.id);
      const secondUrl = photos[1]!.urlFoto;
      expect(photos.filter((p) => p.esPrincipal).map((p) => p.urlFoto)).toEqual([secondUrl]);

      // Reordenar: subir la tercera una posición
      const thirdUrl = photos[2]!.urlFoto;
      await photoItems(page).nth(2).getByRole('button', { name: copy.moveUp }).click();
      await expect
        .poll(async () => (await dbPhotos(vehicle.id)).map((p) => p.urlFoto))
        .toEqual([photos[0]!.urlFoto, thirdUrl, secondUrl]);

      // Catálogo público: la tarjeta usa la miniatura de la PRINCIPAL
      await page.goto(`/catalogo?color=${encodeURIComponent(vehicle.color)}`);
      const card = page.getByRole('main').getByRole('article');
      await expect(card).toHaveCount(1);
      const principalId = UUID_URL.exec(secondUrl)![1]!;
      await expect(card.locator(`img[src*="${principalId}_t.webp"]`)).toBeVisible();

      // Ficha pública: contador 1 / 3 y la imagen principal es la marcada
      await page.goto(`/vehiculos/${vehicle.id}`);
      await expect(page.getByRole('main').getByText('1 / 3')).toBeVisible();
      await expect(
        page.getByRole('main').locator(`img[src*="${principalId}.webp"]`).first()
      ).toBeVisible();

      // El archivo se sirve como WebP con cabeceras seguras
      const served = await page.request.get(secondUrl);
      expect(served.status()).toBe(200);
      expect(served.headers()['content-type']).toBe('image/webp');
      expect(served.headers()['x-content-type-options']).toBe('nosniff');
      expect((await served.body()).subarray(0, 4).toString()).toBe('RIFF');
    } finally {
      await context.close();
    }
  });

  test('eliminar la principal promueve la siguiente y borra los archivos del disco', async ({
    browser,
  }) => {
    const vehicle = await makeVehicle();
    const { context, page } = await sessionFor(browser, (await makeUser('ASESOR')).email);
    try {
      await page.goto(`/admin/vehiculos/${vehicle.id}`);
      await upload(page, [
        file('a.png', 'image/png', await image.png()),
        file('b.jpg', 'image/jpeg', await image.jpeg()),
      ]);
      await expect(photoItems(page)).toHaveCount(2);
      const [first, second] = await dbPhotos(vehicle.id);
      expect(first!.esPrincipal).toBe(true);
      expect((await page.request.get(first!.urlFoto)).status()).toBe(200);

      const item = photoItems(page).first();
      await item.getByText(copy.remove, { exact: true }).click();
      await item.getByRole('button', { name: copy.removeConfirm }).click();

      await expect(photoItems(page)).toHaveCount(1);
      const remaining = await dbPhotos(vehicle.id);
      expect(remaining.map((p) => p.id)).toEqual([second!.id]);
      expect(remaining[0]).toMatchObject({ esPrincipal: true, ordenPresentacion: 1 });

      // El archivo ya no existe (ni su miniatura)
      expect((await page.request.get(first!.urlFoto)).status()).toBe(404);
      expect((await page.request.get(first!.urlFoto.replace('.webp', '_t.webp'))).status()).toBe(
        404
      );
      expect((await page.request.get(second!.urlFoto)).status()).toBe(200);
    } finally {
      await context.close();
    }
  });

  test('un archivo que no es imagen renombrado a .jpg y uno de más de 5 MB se rechazan con mensaje claro', async ({
    browser,
  }) => {
    const vehicle = await makeVehicle();
    const { context, page } = await sessionFor(browser, (await makeUser('ASESOR')).email);
    try {
      await page.goto(`/admin/vehiculos/${vehicle.id}`);
      const main = page.getByRole('main');

      await upload(page, [
        file('buena.png', 'image/png', await image.png()),
        file('malicioso.jpg', 'image/jpeg', Buffer.from('<?php system($_GET["c"]); ?>')),
      ]);
      await expect(
        main
          .getByRole('alert')
          .filter({ hasText: 'La fotografía 2 no es un JPEG, PNG o WebP válido.' })
      ).toBeVisible();

      await upload(page, [file('enorme.jpg', 'image/jpeg', Buffer.alloc(5 * 1024 * 1024 + 1, 7))]);
      await expect(
        main.getByRole('alert').filter({ hasText: 'La fotografía 1 supera los 5 MB.' })
      ).toBeVisible();

      // Una imagen con firma válida pero contenido dañado
      const valid = await image.jpeg();
      await upload(page, [file('rota.jpg', 'image/jpeg', valid.subarray(0, 120))]);
      await expect(
        main
          .getByRole('alert')
          .filter({ hasText: 'La fotografía 1 está dañada o es demasiado grande.' })
      ).toBeVisible();

      // Todo o nada: ninguna de las fotos del primer intento se guardó
      expect(await dbPhotos(vehicle.id)).toHaveLength(0);
    } finally {
      await context.close();
    }
  });

  test('más de 10 fotos por envío se rechazan y el vehículo no supera 20 fotos', async ({
    browser,
  }) => {
    const vehicle = await makeVehicle();
    const { context, page } = await sessionFor(browser, (await makeUser('ASESOR')).email);
    try {
      await page.goto(`/admin/vehiculos/${vehicle.id}`);
      const tiny = await sharp({
        create: { width: 16, height: 16, channels: 3, background: '#123456' },
      })
        .png()
        .toBuffer();
      const eleven = Array.from({ length: 11 }, (_, i) => file(`f${i}.png`, 'image/png', tiny));
      await upload(page, eleven);
      await expect(
        page.getByRole('main').getByRole('alert').filter({ hasText: copy.errors.tooManyFiles })
      ).toBeVisible();
      expect(await dbPhotos(vehicle.id)).toHaveLength(0);

      // 2 envíos de 10 llenan el vehículo (20); el tercero se rechaza
      for (let round = 0; round < 2; round++) {
        await page.goto(`/admin/vehiculos/${vehicle.id}`);
        await upload(page, eleven.slice(0, 10));
        await expect(page.getByRole('main').getByText('Se subieron 10 fotografías.')).toBeVisible();
      }
      expect(await dbPhotos(vehicle.id)).toHaveLength(20);
      await page.goto(`/admin/vehiculos/${vehicle.id}`);
      await upload(page, [eleven[0]!]);
      await expect(
        page.getByRole('main').getByRole('alert').filter({ hasText: copy.errors.limit })
      ).toBeVisible();
      expect(await dbPhotos(vehicle.id)).toHaveLength(20);
    } finally {
      await context.close();
    }
  });

  test('la recodificación elimina el EXIF: el archivo servido no contiene los metadatos originales', async ({
    browser,
  }) => {
    const vehicle = await makeVehicle();
    const { context, page } = await sessionFor(browser, (await makeUser('ASESOR')).email);
    try {
      const original = await image.jpegWithExif();
      expect(original.includes(Buffer.from('SECRETO-GPS-E2E'))).toBe(true);

      await page.goto(`/admin/vehiculos/${vehicle.id}`);
      await upload(page, [file('con-exif.jpg', 'image/jpeg', original)]);
      await expect(page.getByRole('main').getByText('Se subió 1 fotografía.')).toBeVisible();

      const [photo] = await dbPhotos(vehicle.id);
      const body = await (await page.request.get(photo!.urlFoto)).body();
      expect(body.subarray(0, 4).toString()).toBe('RIFF');
      expect(body.includes(Buffer.from('SECRETO-GPS-E2E'))).toBe(false);
      expect((await sharp(body).metadata()).exif).toBeUndefined();
    } finally {
      await context.close();
    }
  });

  test('/media no sale de UPLOADS_DIR: traversal y variantes codificadas responden 404', async ({
    request,
  }) => {
    const paths = [
      '/media/..%2F..%2F.env',
      '/media/%2e%2e%2f%2e%2e%2f.env',
      '/media/..%252F..%252F.env',
      '/media/..\\..\\.env',
      '/media/%2e%2e/%2e%2e/.env',
      '/media/.env',
      '/media/',
      '/media/foto.webp',
      '/media/3f2b8c1e-9d4a-4b7e-8a61-0c5d2e7f9a10.webp',
      '/media/3f2b8c1e-9d4a-4b7e-8a61-0c5d2e7f9a10.webp%00.png',
      '/media/../../package.json',
      '/media/%2e%2e%2f%2e%2e%2fpackage.json',
    ];
    for (const route of paths) {
      const response = await request.get(route, { maxRedirects: 0 });
      expect([404, 307, 308], `${route} → ${response.status()}`).toContain(response.status());
      if (response.status() === 200) throw new Error(`${route} devolvió contenido`);
      const text = await response.text();
      expect(text, route).not.toContain('DATABASE_URL');
      expect(text, route).not.toContain('"name": "jds');
    }
  });

  test('autorización: CLIENTE y anónimo no pueden subir (404 / login) y un origen distinto se rechaza', async ({
    browser,
    request,
  }) => {
    const vehicle = await makeVehicle();
    const multipart = { fotos: file('x.png', 'image/png', await image.png()) };
    const url = `/admin/vehiculos/${vehicle.id}/fotos`;

    // Anónimo: el proxy redirige a login, no se guarda nada
    const anon = await request.post(url, { multipart, maxRedirects: 0 });
    expect(anon.status()).toBe(307);
    expect(anon.headers()['location']).toContain('/login');

    const client = await sessionFor(browser, (await makeUser('CLIENTE')).email);
    const staff = await sessionFor(browser, (await makeUser('ASESOR')).email);
    try {
      // El proxy reescribe a «no encontrado»; un POST a esa ruta lo rechaza Next (400). Nunca se acepta ni se guarda.
      const denied = await client.page.request.post(url, { multipart, maxRedirects: 0 });
      expect([400, 404]).toContain(denied.status());
      expect(await dbPhotos(vehicle.id)).toHaveLength(0);
      expect((await client.page.goto(`/admin/vehiculos/${vehicle.id}`))?.status()).toBe(404);

      // Origen distinto (aunque haya sesión): 403
      const crossOrigin = await staff.page.request.post(url, {
        multipart,
        maxRedirects: 0,
        headers: { origin: 'https://evil.example' },
      });
      expect(crossOrigin.status()).toBe(403);

      // El personal sí (303 de vuelta al panel)
      const ok = await staff.page.request.post(url, { multipart, maxRedirects: 0 });
      expect(ok.status()).toBe(303);
      expect(ok.headers()['location']).toContain(`/admin/vehiculos/${vehicle.id}?foto=subidas`);
      expect(await dbPhotos(vehicle.id)).toHaveLength(1);
    } finally {
      await client.context.close();
      await staff.context.close();
    }
  });

  test('un vehículo inexistente o un id inválido no aceptan subidas', async ({ browser }) => {
    const { context, page } = await sessionFor(browser, (await makeUser('ASESOR')).email);
    try {
      const multipart = { fotos: file('x.png', 'image/png', await image.png()) };
      expect(
        (
          await page.request.post('/admin/vehiculos/abc/fotos', { multipart, maxRedirects: 0 })
        ).status()
      ).toBe(404);
      const missing = await page.request.post('/admin/vehiculos/4294967295/fotos', {
        multipart,
        maxRedirects: 0,
      });
      expect(missing.status()).toBe(303);
      expect(missing.headers()['location']).toContain('fotoError=notFound');
    } finally {
      await context.close();
    }
  });

  test('sin scroll horizontal a 360 px con fotos', async ({ browser }) => {
    const vehicle = await makeVehicle();
    const { context, page } = await sessionFor(browser, (await makeUser('ASESOR')).email, {
      width: 360,
      height: 800,
    });
    try {
      await page.goto(`/admin/vehiculos/${vehicle.id}`);
      await upload(page, [
        file('a.png', 'image/png', await image.png()),
        file('b.jpg', 'image/jpeg', await image.jpeg()),
      ]);
      await expect(photoItems(page)).toHaveCount(2);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
      ).toBeLessThanOrEqual(0);
    } finally {
      await context.close();
    }
  });
});
