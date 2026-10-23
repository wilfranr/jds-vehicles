import { test, expect } from '@playwright/test';
import { Disponibilidad } from '@prisma/client';
import { siteContent } from '../src/lib/site-content';
import { images, randomIp, sessionFor, TestData, upload } from './helpers';

// Recorridos completos del personal y del cliente (F4-08). Cada prueba crea sus datos con `TestData` y los borra
// (con las fotos de `UPLOADS_DIR`, reservas y ventas) aunque falle. El catálogo se filtra siempre por el color
// ÚNICO del vehículo de la prueba: nunca se abre «la primera tarjeta» ni se cuentan filas globales.

const data = new TestData();
const vehicles = siteContent.adminVehicles;
const photos = siteContent.adminPhotos;
const reservations = siteContent.adminReservations;
const sales = siteContent.adminSales;
const statusLabels = siteContent.cuenta.reservations.statusLabels;

test.afterEach(async () => {
  await data.cleanup();
});
test.afterAll(async () => {
  await data.disconnect();
});
test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ 'x-forwarded-for': randomIp() });
});

const catalogUrl = (color: string) => `/catalogo?color=${encodeURIComponent(color)}`;

test.describe('Flujo del personal (F4-08)', () => {
  test('ASESOR crea un vehículo con fotos → aparece en el catálogo → un cliente lo reserva → negociación → venta → desaparece del catálogo y la ficha da «no encontrado»', async ({
    browser,
  }) => {
    const asesor = await data.user('ASESOR', 'Asesora');
    const client = await data.user('CLIENTE', 'Clienta');
    const color = `E2E-RESERVAS-flujo-${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
    const staff = await sessionFor(browser, asesor.email);
    const buyer = await sessionFor(browser, client.email);

    try {
      // 1. Alta del vehículo (NUEVO, sin placa)
      await staff.page.goto('/admin/vehiculos/nuevo');
      const form = staff.page.getByRole('main');
      await form.getByLabel(vehicles.labels.modeloId).selectOption({ label: 'Toyota Corolla' });
      await form.getByLabel(vehicles.labels.anio).fill('2024');
      await form.getByLabel(vehicles.labels.color).fill(color);
      await form.getByLabel(vehicles.labels.condicion).selectOption('NUEVO');
      await form.getByLabel(vehicles.labels.kilometraje).fill('0');
      await form.getByLabel(vehicles.labels.transmision).selectOption('AUTOMATICA');
      await form.getByLabel(vehicles.labels.combustible).selectOption('HIBRIDO');
      await form.getByLabel(vehicles.labels.precio).fill('120000000');
      await form.getByRole('button', { name: vehicles.submitCreate }).click();
      await expect(staff.page).toHaveURL(/\/admin\/vehiculos\/\d+\?creado=1$/);
      const vehicleId = Number(new URL(staff.page.url()).pathname.split('/').pop());
      await data.trackVehicleByColor(color);

      // 2. Fotos: un archivo falso (.jpg que no lo es) se rechaza y luego se suben dos reales
      await upload(staff.page, photos.uploadLabel, photos.uploadSubmit, [
        { name: 'falsa.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('<?php echo 1; ?>') },
      ]);
      await expect(
        staff.page
          .getByRole('main')
          .getByRole('alert')
          .filter({ hasText: 'La fotografía 1 no es un JPEG, PNG o WebP válido.' })
      ).toBeVisible();
      await upload(staff.page, photos.uploadLabel, photos.uploadSubmit, [
        { name: 'a.png', mimeType: 'image/png', buffer: await images.png() },
        { name: 'b.jpg', mimeType: 'image/jpeg', buffer: await images.jpeg() },
      ]);
      await expect(
        staff.page.getByRole('main').getByText('Se subieron 2 fotografías.')
      ).toBeVisible();

      // 3. Aparece en el catálogo con su foto subida (miniatura de /media)
      await buyer.page.goto(catalogUrl(color));
      const card = buyer.page.getByRole('main').getByRole('article');
      await expect(card).toHaveCount(1);
      await expect(card.locator('img[src^="/media/"]')).toBeVisible();

      // 4. El cliente lo reserva desde la ficha
      await buyer.page.goto(`/vehiculos/${vehicleId}`);
      await buyer.page.getByRole('button', { name: siteContent.vehicleDetail.reserveCta }).click();
      await expect(buyer.page).toHaveURL(/\/mi-cuenta\/reservas\/RES-\d{4}-[A-Z2-9]{4}\?nueva=1$/);
      const code = new URL(buyer.page.url()).pathname.split('/').pop()!;

      // 5. El ASESOR la encuentra por el correo del cliente y la pasa a negociación
      await staff.page.goto(`/admin/reservas?q=${encodeURIComponent(client.email)}`);
      const row = staff.page.getByRole('main').getByRole('row').filter({ hasText: code });
      await expect(row).toHaveCount(1);
      await row.getByRole('link', { name: new RegExp(reservations.view) }).click();
      await expect(staff.page).toHaveURL(new RegExp(`/admin/reservas/${code}$`));
      const detail = staff.page.getByRole('main');
      await detail.getByRole('button', { name: reservations.startNegotiation }).click();
      await expect(detail.getByText(reservations.negotiationStarted)).toBeVisible();
      await expect(detail.getByText(statusLabels.EN_NEGOCIACION).first()).toBeVisible();

      // 6. Registra la venta
      await detail.getByLabel(sales.form.price).fill('118000000');
      await detail.getByLabel(sales.form.method).selectOption('TRANSFERENCIA');
      await detail.getByLabel(sales.form.confirm).check();
      await detail.getByRole('button', { name: sales.form.submit }).click();
      await expect(staff.page).toHaveURL(/\/admin\/ventas\/VTA-\d{4}-\d{6}$/);

      // 7. El vehículo desaparece del catálogo y su ficha pública da «no encontrado»
      await buyer.page.goto(catalogUrl(color));
      await expect(buyer.page.getByRole('main').getByRole('article')).toHaveCount(0);
      await buyer.page.goto(`/vehiculos/${vehicleId}`);
      await expect(
        buyer.page.getByRole('heading', { name: siteContent.seo.notFoundVehicleTitle })
      ).toBeVisible();

      // 8. El cliente ve su reserva como completada
      await buyer.page.goto(`/mi-cuenta/reservas/${code}`);
      await expect(
        buyer.page.getByRole('main').getByText(statusLabels.COMPLETADA).first()
      ).toBeVisible();

      // 9. Base de datos
      const venta = await data.prisma.venta.findFirstOrThrow({ where: { vehiculoId: vehicleId } });
      expect(venta).toMatchObject({ compradorId: client.id, vendedorUsuarioId: asesor.id });
      expect(
        await data.prisma.vehiculo.findUniqueOrThrow({ where: { id: vehicleId } })
      ).toMatchObject({
        disponibilidad: 'VENDIDO',
        visibleCatalogo: false,
      });
    } finally {
      await staff.context.close();
      await buyer.context.close();
    }
  });

  test('cancelación: el vehículo vuelve a DISPONIBLE y el catálogo lo muestra de nuevo', async ({
    browser,
  }) => {
    const client = await data.user('CLIENTE', 'Clienta');
    const asesor = await data.user('ASESOR', 'Asesor');
    const vehicle = await data.vehicle({ withPhoto: true });
    const buyer = await sessionFor(browser, client.email);
    const staff = await sessionFor(browser, asesor.email);

    try {
      // El cliente reserva: el catálogo lo marca RESERVADO
      await buyer.page.goto(`/vehiculos/${vehicle.id}`);
      await buyer.page.getByRole('button', { name: siteContent.vehicleDetail.reserveCta }).click();
      await expect(buyer.page).toHaveURL(/\/mi-cuenta\/reservas\/RES-\d{4}-[A-Z2-9]{4}\?nueva=1$/);
      const code = new URL(buyer.page.url()).pathname.split('/').pop()!;
      await buyer.page.goto(catalogUrl(vehicle.color));
      await expect(
        buyer.page.getByRole('main').getByRole('article').getByText('RESERVADO')
      ).toBeVisible();
      expect(
        (await data.prisma.vehiculo.findUniqueOrThrow({ where: { id: vehicle.id } })).disponibilidad
      ).toBe(Disponibilidad.RESERVADO);

      // El ASESOR la cancela con un motivo
      await staff.page.goto(`/admin/reservas/${code}`);
      const detail = staff.page.getByRole('main');
      await detail.getByText(reservations.cancelReservation).click();
      await detail
        .getByLabel(reservations.cancelReasonLabel)
        .fill('El cliente ya no está interesado');
      await detail.getByRole('button', { name: reservations.cancelConfirm }).click();
      await expect(detail.getByText(reservations.cancelled)).toBeVisible();

      // El vehículo está DISPONIBLE: el catálogo ya no lo marca reservado y la ficha vuelve a ofrecer reservar
      expect(
        (await data.prisma.vehiculo.findUniqueOrThrow({ where: { id: vehicle.id } })).disponibilidad
      ).toBe(Disponibilidad.DISPONIBLE);
      await buyer.page.goto(catalogUrl(vehicle.color));
      const card = buyer.page.getByRole('main').getByRole('article');
      await expect(card).toHaveCount(1);
      await expect(card.getByText('RESERVADO')).toHaveCount(0);
      await buyer.page.goto(`/vehiculos/${vehicle.id}`);
      await expect(
        buyer.page.getByRole('button', { name: siteContent.vehicleDetail.reserveCta })
      ).toBeVisible();

      // El cliente ve la reserva cancelada
      await buyer.page.goto(`/mi-cuenta/reservas/${code}`);
      await expect(
        buyer.page.getByRole('main').getByText(statusLabels.CANCELADA).first()
      ).toBeVisible();
    } finally {
      await buyer.context.close();
      await staff.context.close();
    }
  });
});
