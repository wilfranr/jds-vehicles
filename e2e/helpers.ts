import { randomBytes, randomInt } from 'node:crypto';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { expect, type APIRequestContext, type Browser, type Page } from '@playwright/test';
import { Condicion, Disponibilidad, PrismaClient } from '@prisma/client';
import { hashSync } from 'bcryptjs';
import sharp from 'sharp';
import { E2E_EMAIL_DOMAIN, E2E_UPLOADS_DIR, E2E_VEHICLE_COLOR_PREFIX } from './test-data';

/**
 * Utilidades de las pruebas del panel (F4-08). Cada prueba crea sus PROPIOS datos temporales con `TestData`
 * (usuarios `@e2e-test.local`, vehículos de color `E2E-RESERVAS-…`) y los borra en `cleanup()`, junto con sus
 * fotos (filas y archivos de `UPLOADS_DIR`), reservas y ventas, aunque la prueba falle. Nunca se usa «la primera
 * tarjeta» del catálogo ni se cuentan filas globales: se filtra por el color o el correo propios.
 */
export const PASSWORD = 'Clave-E2E-2026';
const PASSWORD_HASH = hashSync(PASSWORD, 4);
const UUID_URL = /^\/media\/([0-9a-f-]{36})\.webp$/;

export type RoleName = 'ADMIN' | 'ASESOR' | 'CLIENTE';

export const randomIp = () => `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`;

export class TestData {
  readonly prisma = new PrismaClient();
  private userIds: number[] = [];
  private vehicleIds: number[] = [];

  async user(rol: RoleName, nombre = 'Persona') {
    const role = await this.prisma.role.findUniqueOrThrow({ where: { nombre: rol } });
    const tag = randomBytes(5).toString('hex');
    const user = await this.prisma.user.create({
      data: {
        rolId: role.id,
        nombre,
        apellido: `Panel${tag}`,
        documentoIdentidad: `E2E${tag}`.toUpperCase(),
        email: `e2e-${tag}${E2E_EMAIL_DOMAIN}`,
        passwordHash: PASSWORD_HASH,
        telefono: '573105551234',
        ciudad: 'Pereira',
      },
    });
    this.userIds.push(user.id);
    return user;
  }

  /** Vehículo del seed-modelo 1 (Toyota Corolla) con color único; opcionalmente con una foto externa. */
  async vehicle(
    options: { disponibilidad?: Disponibilidad; withPhoto?: boolean; condicion?: Condicion } = {}
  ) {
    const color = `${E2E_VEHICLE_COLOR_PREFIX}${randomBytes(4).toString('hex')}`;
    const condicion = options.condicion ?? Condicion.NUEVO;
    const vehicle = await this.prisma.vehiculo.create({
      data: {
        modeloId: 1,
        anio: 2022,
        color,
        condicion,
        placa:
          condicion === Condicion.USADO ? `P${randomBytes(3).toString('hex').toUpperCase()}` : null,
        precio: 88000000,
        disponibilidad: options.disponibilidad ?? Disponibilidad.DISPONIBLE,
        fotos: options.withPhoto
          ? {
              create: [
                {
                  urlFoto: 'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb',
                  esPrincipal: true,
                },
              ],
            }
          : undefined,
      },
    });
    this.vehicleIds.push(vehicle.id);
    return { id: vehicle.id, color };
  }

  /** Reserva en negociación sobre un vehículo RESERVADO propio (código único, sin choques con otras pruebas). */
  async reservation(userId: number, vehicleId: number) {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // el mismo que los códigos reales (1 M de combinaciones)
    const suffix = Array.from({ length: 4 }, () => alphabet[randomInt(alphabet.length)]).join('');
    const code = `RES-2026-${suffix}`;
    await this.prisma.reserva.create({
      data: {
        codigoReserva: code,
        usuarioId: userId,
        vehiculoId: vehicleId,
        estado: 'EN_NEGOCIACION',
      },
    });
    return code;
  }

  /** Venta de un vehículo VENDIDO propio a un comprador propio. */
  async sale(buyerId: number, vehicleId: number) {
    const receipt = `VTA-2032-8${randomInt(10000, 99999)}`;
    await this.prisma.venta.create({
      data: {
        numeroReciboContrato: receipt,
        vehiculoId: vehicleId,
        compradorId: buyerId,
        precioFinal: '1000.00',
        metodoPago: 'EFECTIVO',
        fechaVenta: new Date('2032-05-05T15:00:00Z'),
      },
    });
    return receipt;
  }

  /** Registra un vehículo creado por la interfaz para que `cleanup()` también lo borre. */
  trackVehicleByColor = async (color: string) => {
    const found = await this.prisma.vehiculo.findFirst({ where: { color }, select: { id: true } });
    if (found) this.vehicleIds.push(found.id);
    return found?.id ?? null;
  };

  /** Borra TODO lo creado: archivos de fotos, ventas, reservas, vehículos y usuarios. Seguro aunque falte algo. */
  async cleanup() {
    const photos = await this.prisma.vehiculoFoto.findMany({
      where: { vehiculoId: { in: this.vehicleIds } },
      select: { urlFoto: true },
    });
    for (const { urlFoto } of photos) {
      const match = UUID_URL.exec(urlFoto);
      if (!match) continue;
      for (const name of [`${match[1]}.webp`, `${match[1]}_t.webp`]) {
        await rm(path.join(E2E_UPLOADS_DIR, name), { force: true });
      }
    }
    await this.prisma.venta.deleteMany({
      where: {
        OR: [{ vehiculoId: { in: this.vehicleIds } }, { compradorId: { in: this.userIds } }],
      },
    });
    await this.prisma.reserva.deleteMany({
      where: { OR: [{ vehiculoId: { in: this.vehicleIds } }, { usuarioId: { in: this.userIds } }] },
    });
    await this.prisma.vehiculo.deleteMany({ where: { id: { in: this.vehicleIds } } });
    await this.prisma.user.deleteMany({ where: { id: { in: this.userIds } } });
    this.userIds = [];
    this.vehicleIds = [];
  }

  async disconnect() {
    await this.prisma.$disconnect();
  }
}

/** Inicia sesión por la interfaz en un contexto nuevo con su propia IP (TRUST_PROXY=true en el servidor de e2e). */
export async function sessionFor(
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

export const images = {
  png: (color = '#cc3333') =>
    sharp({ create: { width: 640, height: 400, channels: 3, background: color } })
      .png()
      .toBuffer(),
  jpeg: (color = '#33cc33') =>
    sharp({ create: { width: 800, height: 500, channels: 3, background: color } })
      .jpeg()
      .toBuffer(),
};

export function upload(
  page: Page,
  label: string,
  button: string,
  files: { name: string; mimeType: string; buffer: Buffer }[]
) {
  const main = page.getByRole('main');
  return main
    .getByLabel(label)
    .setInputFiles(files)
    .then(() => main.getByRole('button', { name: button }).click());
}

export interface CapturedAction {
  headers: Record<string, string>;
  body: Buffer;
}

/** Captura la petición de una Server Action tal como la envía el navegador (sin dejar que llegue al servidor). */
export async function captureBlocked(
  page: Page,
  trigger: () => Promise<void>
): Promise<CapturedAction> {
  let captured: CapturedAction | null = null;
  await page.route('**/admin/**', async (route) => {
    const request = route.request();
    if (request.method() === 'POST' && request.headers()['next-action']) {
      const h = request.headers();
      captured = {
        headers: Object.fromEntries(
          ['next-action', 'content-type', 'accept', 'next-router-state-tree']
            .filter((name) => h[name])
            .map((name) => [name, h[name]!])
        ),
        body: request.postDataBuffer() ?? Buffer.alloc(0),
      };
      await route.abort();
      return;
    }
    await route.continue();
  });
  await trigger();
  await expect.poll(() => captured).not.toBeNull();
  await page.unroute('**/admin/**');
  return captured!;
}

export function replay(
  ctx: APIRequestContext,
  path: string,
  action: CapturedAction,
  baseURL: string
) {
  return ctx.post(path, {
    headers: { ...action.headers, origin: baseURL },
    data: action.body,
    maxRedirects: 0,
    failOnStatusCode: false,
  });
}
