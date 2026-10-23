import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { randomIp, sessionFor, TestData } from './helpers';

// Accesibilidad (F5-02): axe-core con WCAG 2.1 A/AA en escritorio (1280 px) y móvil (360 px). Falla con
// violaciones `serious`/`critical`. Sin excepciones: si alguna fuera inevitable, se justifica aquí mismo.
// Datos propios por prueba, borrados aunque falle.

const data = new TestData();
test.afterEach(async () => {
  await data.cleanup();
});
test.afterAll(async () => {
  await data.disconnect();
});

const VIEWPORTS = {
  escritorio: { width: 1280, height: 800 },
  móvil: { width: 360, height: 740 },
} as const;

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function expectAccessible(page: Page, label: string) {
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  await page.waitForLoadState('networkidle');
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const serious = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  const report = serious.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.help}\n` +
      v.nodes
        .slice(0, 4)
        .map((n) => `   ${n.target.join(' ')}`)
        .join('\n')
  );
  expect(report, `violaciones de accesibilidad en ${label}`).toEqual([]);
}

interface Fixtures {
  vehicleId: number;
  color: string;
  code: string;
  receipt: string;
  clientEmail: string;
  staffEmail: string;
  adminEmail: string;
}

async function fixtures(): Promise<Fixtures> {
  const client = await data.user('CLIENTE', 'Clienta');
  const staff = await data.user('ASESOR', 'Asesora');
  const admin = await data.user('ADMIN', 'Admina');
  const vehicle = await data.vehicle({ withPhoto: true });
  const reserved = await data.vehicle({ disponibilidad: 'RESERVADO', withPhoto: true });
  const sold = await data.vehicle({ disponibilidad: 'VENDIDO', withPhoto: true });
  return {
    vehicleId: vehicle.id,
    color: vehicle.color,
    code: await data.reservation(client.id, reserved.id),
    receipt: await data.sale(client.id, sold.id),
    clientEmail: client.email,
    staffEmail: staff.email,
    adminEmail: admin.email,
  };
}

type Audience = 'anonimo' | 'cliente' | 'staff' | 'admin';
const pages: { name: string; audience: Audience; path: (f: Fixtures) => string }[] = [
  { name: 'portada', audience: 'anonimo', path: () => '/' },
  { name: 'catálogo', audience: 'anonimo', path: () => '/catalogo' },
  {
    name: 'catálogo con filtros',
    audience: 'anonimo',
    path: (f) => `/catalogo?color=${encodeURIComponent(f.color)}&condicion=NUEVO&orden=precio-asc`,
  },
  { name: 'ficha de vehículo', audience: 'anonimo', path: (f) => `/vehiculos/${f.vehicleId}` },
  { name: 'próximamente', audience: 'anonimo', path: () => '/proximamente' },
  { name: 'cómo funciona', audience: 'anonimo', path: () => '/como-funciona' },
  { name: 'contacto', audience: 'anonimo', path: () => '/contacto' },
  { name: 'login', audience: 'anonimo', path: () => '/login' },
  { name: 'registro', audience: 'anonimo', path: () => '/registro' },
  { name: 'mi cuenta (perfil)', audience: 'cliente', path: () => '/mi-cuenta' },
  { name: 'mi cuenta (seguridad)', audience: 'cliente', path: () => '/mi-cuenta/seguridad' },
  { name: 'mis reservas', audience: 'cliente', path: () => '/mi-cuenta/reservas' },
  { name: 'detalle de reserva', audience: 'cliente', path: (f) => `/mi-cuenta/reservas/${f.code}` },
  { name: 'panel: resumen', audience: 'staff', path: () => '/admin' },
  { name: 'panel: reservas', audience: 'staff', path: () => '/admin/reservas' },
  {
    name: 'panel: detalle de reserva',
    audience: 'staff',
    path: (f) => `/admin/reservas/${f.code}`,
  },
  { name: 'panel: vehículos', audience: 'staff', path: () => '/admin/vehiculos' },
  { name: 'panel: nuevo vehículo', audience: 'staff', path: () => '/admin/vehiculos/nuevo' },
  {
    name: 'panel: formulario de vehículo y fotos',
    audience: 'staff',
    path: (f) => `/admin/vehiculos/${f.vehicleId}`,
  },
  { name: 'panel: marcas y modelos', audience: 'staff', path: () => '/admin/vehiculos/marcas' },
  { name: 'panel: ventas', audience: 'staff', path: () => '/admin/ventas' },
  { name: 'panel: detalle de venta', audience: 'staff', path: (f) => `/admin/ventas/${f.receipt}` },
  { name: 'panel: usuarios', audience: 'admin', path: () => '/admin/usuarios' },
  { name: 'panel: configuración', audience: 'admin', path: () => '/admin/configuracion' },
];

async function open(
  browser: Browser,
  audience: Audience,
  f: Fixtures,
  viewport: { width: number; height: number }
) {
  if (audience === 'anonimo') {
    const context = await browser.newContext({
      viewport,
      extraHTTPHeaders: { 'x-forwarded-for': randomIp() },
    });
    return { context, page: await context.newPage() };
  }
  const email = { cliente: f.clientEmail, staff: f.staffEmail, admin: f.adminEmail }[audience];
  return sessionFor(browser, email, viewport);
}

for (const [viewportName, viewport] of Object.entries(VIEWPORTS)) {
  test.describe(`Accesibilidad WCAG 2.1 AA — ${viewportName} (${viewport.width} px)`, () => {
    for (const entry of pages) {
      test(entry.name, async ({ browser }) => {
        const f = await fixtures();
        const { context, page } = await open(browser, entry.audience, f, viewport);
        try {
          await page.goto(entry.path(f));
          await expectAccessible(page, `${entry.name} (${viewportName})`);
        } finally {
          await context.close();
        }
      });
    }
  });
}
