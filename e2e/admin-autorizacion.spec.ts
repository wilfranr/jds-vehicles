import { randomInt } from 'node:crypto';
import { test, expect, type APIRequestContext, type APIResponse } from '@playwright/test';
import { siteContent } from '../src/lib/site-content';
import { captureBlocked, randomIp, replay, sessionFor, TestData } from './helpers';

// Matriz de autorización del panel (F4-08): cada ruta y cada Server Action de /admin frente a anónimo, CLIENTE,
// ASESOR, ADMIN y un usuario DEGRADADO con la sesión aún vigente (el JWT no se revoca). Datos propios por prueba,
// borrados aunque falle; nada de «primera tarjeta» ni de conteos globales.

const data = new TestData();
const users = siteContent.adminUsers;

test.afterEach(async () => {
  await data.cleanup();
});
test.afterAll(async () => {
  await data.disconnect();
});
test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ 'x-forwarded-for': randomIp() });
});

type MinRole = 'STAFF' | 'ADMIN';

/** Un mismo juego de datos temporales para todas las rutas con parámetros. */
async function fixtures() {
  const client = await data.user('CLIENTE', 'Clienta');
  const vehicle = await data.vehicle();
  const reserved = await data.vehicle({ disponibilidad: 'RESERVADO' });
  const sold = await data.vehicle({ disponibilidad: 'VENDIDO' });
  const code = `RES-2026-M${Math.floor(Math.random() * 1e6)
    .toString(36)
    .toUpperCase()
    .replace(/[01OIL]/g, '2')
    .padEnd(3, '2')
    .slice(0, 3)}`;
  await data.prisma.reserva.create({
    data: {
      codigoReserva: code,
      usuarioId: client.id,
      vehiculoId: reserved.id,
      estado: 'EN_NEGOCIACION',
    },
  });
  const receipt = `VTA-2031-9${randomInt(10000, 99999)}`;
  await data.prisma.venta.create({
    data: {
      numeroReciboContrato: receipt,
      vehiculoId: sold.id,
      compradorId: client.id,
      precioFinal: '1000.00',
      metodoPago: 'EFECTIVO',
      fechaVenta: new Date('2031-05-05T15:00:00Z'),
    },
  });
  return { vehicleId: vehicle.id, code, receipt };
}

function routes(f: Awaited<ReturnType<typeof fixtures>>): [string, MinRole][] {
  return [
    ['/admin', 'STAFF'],
    ['/admin/reservas', 'STAFF'],
    [`/admin/reservas/${f.code}`, 'STAFF'],
    ['/admin/ventas', 'STAFF'],
    [`/admin/ventas/${f.receipt}`, 'STAFF'],
    ['/admin/vehiculos', 'STAFF'],
    ['/admin/vehiculos/nuevo', 'STAFF'],
    ['/admin/vehiculos/marcas', 'STAFF'],
    [`/admin/vehiculos/${f.vehicleId}`, 'STAFF'],
    ['/admin/usuarios', 'ADMIN'],
    ['/admin/configuracion', 'ADMIN'],
  ];
}

async function status(ctx: APIRequestContext, path: string): Promise<APIResponse> {
  return ctx.get(path, { maxRedirects: 0 });
}

test.describe('Matriz de autorización de /admin', () => {
  test('cada ruta: anónimo → login, CLIENTE → 404, ASESOR y ADMIN según el rol mínimo', async ({
    browser,
    request,
  }) => {
    const f = await fixtures();
    const client = await sessionFor(browser, (await data.user('CLIENTE')).email);
    const asesor = await sessionFor(browser, (await data.user('ASESOR')).email);
    const admin = await sessionFor(browser, (await data.user('ADMIN')).email);
    try {
      for (const [path, min] of routes(f)) {
        const anon = await status(request, path);
        expect(anon.status(), `anónimo ${path}`).toBe(307);
        expect(anon.headers()['location'], `anónimo ${path}`).toContain(
          `/login?next=${encodeURIComponent(path)}`
        );

        expect((await status(client.page.request, path)).status(), `CLIENTE ${path}`).toBe(404);

        const asesorStatus = (await status(asesor.page.request, path)).status();
        expect(asesorStatus, `ASESOR ${path}`).toBe(min === 'ADMIN' ? 404 : 200);

        expect((await status(admin.page.request, path)).status(), `ADMIN ${path}`).toBe(200);
      }
    } finally {
      await client.context.close();
      await asesor.context.close();
      await admin.context.close();
    }
  });

  test('la subida de fotos: anónimo a login y CLIENTE rechazado; los códigos y recibos mal formados no filtran nada', async ({
    browser,
    request,
  }) => {
    const f = await fixtures();
    const multipart = { fotos: { name: 'x.png', mimeType: 'image/png', buffer: Buffer.from('x') } };
    const url = `/admin/vehiculos/${f.vehicleId}/fotos`;

    const anon = await request.post(url, { multipart, maxRedirects: 0 });
    expect(anon.status()).toBe(307);
    expect(anon.headers()['location']).toContain('/login');

    const client = await sessionFor(browser, (await data.user('CLIENTE')).email);
    const asesor = await sessionFor(browser, (await data.user('ASESOR')).email);
    try {
      expect([400, 404]).toContain(
        (await client.page.request.post(url, { multipart, maxRedirects: 0 })).status()
      );
      expect(await data.prisma.vehiculoFoto.count({ where: { vehiculoId: f.vehicleId } })).toBe(0);

      for (const bad of [
        '/admin/reservas/RES-1-X',
        '/admin/ventas/VTA-1-1',
        '/admin/vehiculos/abc',
      ]) {
        await asesor.page.goto(bad);
        await expect(
          asesor.page.getByRole('heading', { name: siteContent.errorPages.notFoundTitle })
        ).toBeVisible();
      }
    } finally {
      await client.context.close();
      await asesor.context.close();
    }
  });
});

// ---------------------------------------------------------------- Server Actions de usuarios

test.describe('Server Actions de usuarios (replay de la petición real del ADMIN)', () => {
  test('cambiar rol y restablecer clave: solo ADMIN surte efecto; ASESOR, CLIENTE, anónimo y un ADMIN degradado con sesión vigente no cambian nada', async ({
    browser,
    request,
    baseURL,
  }) => {
    const target = await data.user('CLIENTE', 'Objetivo');
    const originalHash = target.passwordHash;
    const adminUser = await data.user('ADMIN', 'Administrador');
    const admin = await sessionFor(browser, adminUser.email);
    const asesor = await sessionFor(browser, (await data.user('ASESOR')).email);
    const client = await sessionFor(browser, (await data.user('CLIENTE')).email);
    // Sesión de un ADMIN que luego será degradado en la BD (el token sigue diciendo ADMIN)
    const degradedUser = await data.user('ADMIN', 'Degradado');
    const degraded = await sessionFor(browser, degradedUser.email);

    const roleOf = async () =>
      (
        await data.prisma.user.findUniqueOrThrow({
          where: { id: target.id },
          include: { rol: true },
        })
      ).rol.nombre;
    const hashOf = async () =>
      (await data.prisma.user.findUniqueOrThrow({ where: { id: target.id } })).passwordHash;
    const clientRole = await data.prisma.role.findUniqueOrThrow({ where: { nombre: 'CLIENTE' } });
    const resetRole = () =>
      data.prisma.user.update({ where: { id: target.id }, data: { rolId: clientRole.id } });

    try {
      // — Captura (sin que llegue al servidor) de las peticiones reales que envía el ADMIN desde la interfaz
      await admin.page.goto(`/admin/usuarios?q=${encodeURIComponent(target.email)}`);
      const row = admin.page.getByRole('main').getByRole('row').filter({ hasText: target.email });
      await expect(row).toHaveCount(1);

      const changeRole = await captureBlocked(admin.page, async () => {
        await row.getByRole('combobox').selectOption('ASESOR');
        await row.getByRole('button', { name: users.changeRole }).click();
      });
      // La acción abortada deja la cola de acciones de esa página sin resolver: se recarga antes de la siguiente.
      await admin.page.goto(`/admin/usuarios?q=${encodeURIComponent(target.email)}`);
      const resetPassword = await captureBlocked(admin.page, async () => {
        await row.getByText(users.resetPassword).click();
        await row.getByRole('button', { name: users.resetConfirm }).click();
      });
      expect(await roleOf()).toBe('CLIENTE'); // lo capturado no se ejecutó
      expect(await hashOf()).toBe(originalHash);

      // — CONTROL: el mismo replay con la sesión del ADMIN SÍ surte efecto (demuestra que el replay es válido)
      const control = await replay(admin.page.request, '/admin/reservas', changeRole, baseURL!);
      expect(control.status()).toBeLessThan(500);
      await expect.poll(roleOf).toBe('ASESOR');
      await resetRole();
      await replay(admin.page.request, '/admin/reservas', resetPassword, baseURL!);
      await expect.poll(hashOf).not.toBe(originalHash);
      await data.prisma.user.update({
        where: { id: target.id },
        data: { passwordHash: originalHash },
      });

      // — Degradar al tercer ADMIN en la BD: su JWT sigue siendo de ADMIN
      const asesorRole = await data.prisma.role.findUniqueOrThrow({ where: { nombre: 'ASESOR' } });
      await data.prisma.user.update({
        where: { id: degradedUser.id },
        data: { rolId: asesorRole.id },
      });

      // — Sin efecto: se reenvían a una ruta accesible para esa sesión (las acciones se resuelven por su id)
      const attackers: [string, APIRequestContext][] = [
        ['ASESOR', asesor.page.request],
        ['CLIENTE', client.page.request],
        ['anónimo', request],
        ['ADMIN degradado a ASESOR con sesión vigente', degraded.page.request],
      ];
      for (const [who, ctx] of attackers) {
        for (const [name, action] of [
          ['cambiar rol', changeRole],
          ['restablecer clave', resetPassword],
        ] as const) {
          const response = await replay(ctx, '/admin/reservas', action, baseURL!);
          // Next reenvía la acción a la página que la define (/admin/usuarios): para ASESOR y CLIENTE lo frena el
          // proxy (la acción queda «no disponible», 409/404); para el anónimo, redirección a login; para el ADMIN
          // degradado el proxy lo deja pasar (el token sigue diciendo ADMIN) y es la propia acción
          // (`requireAdmin`, que consulta la BD) la que lo rechaza: respuesta sin efecto.
          if (who === 'anónimo') expect(response.status(), `${who} · ${name}`).toBe(307);
          else if (who.startsWith('ADMIN degradado')) expect(response.status()).toBeLessThan(500);
          else expect([400, 404, 409], `${who} · ${name}`).toContain(response.status());
          // dar tiempo a un posible efecto tardío y comprobar que NO ocurrió
          expect(await roleOf(), `${who} · ${name}: rol`).toBe('CLIENTE');
          expect(await hashOf(), `${who} · ${name}: clave`).toBe(originalHash);
        }
      }

      // El degradado tampoco ve ya las páginas de ADMIN (la BD manda sobre el token), pero sí las de personal
      await degraded.page.goto('/admin/usuarios');
      await expect(
        degraded.page.getByRole('heading', { name: siteContent.errorPages.notFoundTitle })
      ).toBeVisible();
      await degraded.page.goto('/admin/reservas');
      await expect(
        degraded.page.getByRole('heading', { name: siteContent.admin.sections.reservas, level: 1 })
      ).toBeVisible();
    } finally {
      await admin.context.close();
      await asesor.context.close();
      await client.context.close();
      await degraded.context.close();
    }
  });
});

test.describe('Sesión vigente de un usuario degradado o desactivado', () => {
  test('un ADMIN o ASESOR degradado a CLIENTE (o desactivado) con la sesión abierta pierde el acceso al panel de inmediato', async ({
    browser,
  }) => {
    const staffUser = await data.user('ASESOR', 'Degradada');
    const disabledUser = await data.user('ADMIN', 'Desactivado');
    const staff = await sessionFor(browser, staffUser.email);
    const disabled = await sessionFor(browser, disabledUser.email);
    try {
      for (const { page } of [staff, disabled]) {
        await page.goto('/admin');
        await expect(
          page.getByRole('heading', { name: siteContent.admin.dashboard.title, level: 1 })
        ).toBeVisible();
      }

      const clientRole = await data.prisma.role.findUniqueOrThrow({ where: { nombre: 'CLIENTE' } });
      await data.prisma.user.update({
        where: { id: staffUser.id },
        data: { rolId: clientRole.id },
      });
      await data.prisma.user.update({ where: { id: disabledUser.id }, data: { activo: false } });

      for (const { page } of [staff, disabled]) {
        for (const path of [
          '/admin',
          '/admin/reservas',
          '/admin/ventas',
          '/admin/vehiculos',
          '/admin/usuarios',
        ]) {
          await page.goto(path);
          await expect(
            page.getByRole('heading', { name: siteContent.errorPages.notFoundTitle }),
            path
          ).toBeVisible();
          await expect(page.getByText(siteContent.admin.dashboard.vehiclesHeading)).toHaveCount(0);
        }
      }
    } finally {
      await staff.context.close();
      await disabled.context.close();
    }
  });
});
