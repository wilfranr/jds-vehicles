// @vitest-environment node
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { EstadoReserva, TipoDocumento } from '@prisma/client';
import { prisma } from '@/lib/db';
import { createVehicleSchema, type VehicleInput } from '@/lib/validation/vehicle';
import { siteContent } from '@/lib/site-content';
import {
  createBrand,
  createModel,
  listBrandsWithModels,
  renameBrand,
  renameModel,
  setBrandActive,
  setModelActive,
} from './catalog-admin';
import { buildEditRaw, currentAsRaw, vehicleLock } from './vehicle-rules';
import {
  createVehicle,
  getAdminVehicle,
  listAdminVehicles,
  listSelectableModels,
  setVehicleVisibility,
  updateVehicle,
} from './vehicles';

// BD sembrada; los datos temporales se identifican por el prefijo TMPF403 (color/nombre) o los ids 9601+ de usuario.
const TAG = 'TMPF403';
const USER_ID = 9601;
let dbUp = false;
try {
  await prisma.$queryRaw`SELECT 1`;
  dbUp = true;
} catch {
  if (process.env.CI) throw new Error('Las pruebas del panel necesitan la BD en CI.');
}

const e = siteContent.adminVehicles.errors;
const schema = createVehicleSchema(
  {
    modelo: e.modelo,
    anio: e.anio,
    color: e.color,
    condicion: e.condicion,
    placa: e.placa,
    placaRequired: e.placaRequired,
    placaNotForNew: e.placaNotForNew,
    precio: e.precio,
    kilometraje: e.kilometraje,
    kilometrajeNew: e.kilometrajeNew,
    transmision: e.transmision,
    combustible: e.combustible,
    cilindraje: e.cilindraje,
    descripcion: e.descripcion,
    disponibilidad: e.disponibilidad,
  },
  () => new Date('2026-10-23T00:00:00Z')
);

let modeloId = 0;
let counter = 0;

function input(overrides: Partial<Record<string, string>> = {}): VehicleInput {
  const raw = {
    modeloId: String(modeloId),
    anio: '2021',
    color: `${TAG}-${++counter}`,
    condicion: 'USADO',
    placa: `T${String(counter).padStart(3, '0')}${Math.floor(Math.random() * 900 + 100)}`,
    precio: '50000000',
    kilometraje: '1000',
    transmision: 'MANUAL',
    combustible: 'GASOLINA',
    cilindraje: '',
    descripcion: '',
    disponibilidad: 'DISPONIBLE',
    ...overrides,
  };
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new Error(JSON.stringify(parsed.error.issues));
  return parsed.data;
}

async function cleanup() {
  const vehicles = await prisma.vehiculo.findMany({
    where: { color: { startsWith: TAG } },
    select: { id: true },
  });
  const ids = vehicles.map((v) => v.id);
  await prisma.reserva.deleteMany({
    where: { OR: [{ vehiculoId: { in: ids } }, { usuarioId: USER_ID }] },
  });
  await prisma.vehiculo.deleteMany({ where: { id: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: USER_ID } });
  const models = await prisma.modelo.findMany({
    where: { nombre: { startsWith: TAG } },
    select: { id: true },
  });
  await prisma.modelo.deleteMany({ where: { id: { in: models.map((m) => m.id) } } });
  await prisma.marca.deleteMany({ where: { nombre: { startsWith: TAG } } });
}

async function makeUser() {
  await prisma.user.create({
    data: {
      id: USER_ID,
      rolId: 1,
      nombre: 'Prueba',
      apellido: 'Inventario',
      tipoDocumento: TipoDocumento.CC,
      documentoIdentidad: `TMP${USER_ID}`,
      email: `tmp-${USER_ID}@example.com`,
      passwordHash: 'x',
      telefono: '573000000000',
    },
  });
}

describe.skipIf(!dbUp)('gestión de vehículos (BD)', () => {
  afterEach(cleanup);
  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it('crea un vehículo visible y lo devuelve en el listado administrativo', async () => {
    modeloId = (await prisma.modelo.findFirstOrThrow({ where: { activo: true } })).id;
    const data = input();
    const result = await createVehicle(data);
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;

    const detail = await getAdminVehicle(result.id);
    expect(detail).toMatchObject({
      placa: data.placa,
      precio: '50000000.00',
      visibleCatalogo: true,
      disponibilidad: 'DISPONIBLE',
      hasActiveReservation: false,
    });
    const list = await listAdminVehicles({ q: data.color, page: 1 });
    expect(list.items.map((v) => v.id)).toEqual([result.id]);
  });

  it('un NUEVO se crea sin placa y con 0 km', async () => {
    modeloId = (await prisma.modelo.findFirstOrThrow({ where: { activo: true } })).id;
    const result = await createVehicle(input({ condicion: 'NUEVO', placa: '', kilometraje: '0' }));
    expect(result.status).toBe('ok');
  });

  it('placa duplicada entre no vendidos → plate_duplicate; si el otro está VENDIDO, se permite', async () => {
    modeloId = (await prisma.modelo.findFirstOrThrow({ where: { activo: true } })).id;
    const first = input();
    const created = await createVehicle(first);
    expect(created.status).toBe('ok');
    expect(await createVehicle(input({ placa: first.placa! }))).toEqual({
      status: 'plate_duplicate',
    });

    if (created.status === 'ok') {
      await prisma.vehiculo.update({
        where: { id: created.id },
        data: { disponibilidad: 'VENDIDO', visibleCatalogo: false },
      });
    }
    expect((await createVehicle(input({ placa: first.placa! }))).status).toBe('ok');
  });

  it('dos altas simultáneas con la misma placa: solo una se crea', async () => {
    modeloId = (await prisma.modelo.findFirstOrThrow({ where: { activo: true } })).id;
    const plate = 'TCARRERA9';
    const results = await Promise.all([
      createVehicle(input({ placa: plate })),
      createVehicle(input({ placa: plate })),
      createVehicle(input({ placa: plate })),
    ]);
    expect(results.filter((r) => r.status === 'ok')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'plate_duplicate')).toHaveLength(2);
    expect(await prisma.vehiculo.count({ where: { placa: plate } })).toBe(1);
  });

  it('modelo inactivo o inexistente → model_invalid', async () => {
    const brand = await createBrand(`${TAG}-marca`);
    if (brand.status !== 'ok') throw new Error('no se creó la marca');
    const model = await createModel(brand.id, `${TAG}-modelo`);
    if (model.status !== 'ok') throw new Error('no se creó el modelo');
    modeloId = model.id;
    await setModelActive(model.id, false);

    expect(await createVehicle(input())).toEqual({ status: 'model_invalid' });
    modeloId = 4_000_000_000;
    expect(await createVehicle(input())).toEqual({ status: 'model_invalid' });
  });

  it('editar: cambia solo los campos permitidos y la placa propia no choca consigo misma', async () => {
    modeloId = (await prisma.modelo.findFirstOrThrow({ where: { activo: true } })).id;
    const data = input();
    const created = await createVehicle(data);
    if (created.status !== 'ok') throw new Error('no se creó');

    const result = await updateVehicle(created.id, () =>
      input({ placa: data.placa!, precio: '60000000.50', color: data.color })
    );
    expect(result).toEqual({ status: 'ok', id: created.id });
    expect((await getAdminVehicle(created.id))?.precio).toBe('60000000.50');
  });

  it('editar a una placa de otro vehículo → plate_duplicate sin cambios', async () => {
    modeloId = (await prisma.modelo.findFirstOrThrow({ where: { activo: true } })).id;
    const a = input();
    const b = input();
    const [ra, rb] = [await createVehicle(a), await createVehicle(b)];
    if (ra.status !== 'ok' || rb.status !== 'ok') throw new Error('no se crearon');

    expect(await updateVehicle(rb.id, () => input({ placa: a.placa!, color: b.color }))).toEqual({
      status: 'plate_duplicate',
    });
    expect((await getAdminVehicle(rb.id))?.placa).toBe(b.placa);
  });

  it('con reserva activa solo se editan precio y descripción; no se oculta ni se cambia la disponibilidad', async () => {
    modeloId = (await prisma.modelo.findFirstOrThrow({ where: { activo: true } })).id;
    await makeUser();
    const data = input();
    const created = await createVehicle(data);
    if (created.status !== 'ok') throw new Error('no se creó');
    await prisma.vehiculo.update({
      where: { id: created.id },
      data: { disponibilidad: 'RESERVADO' },
    });
    await prisma.reserva.create({
      data: {
        codigoReserva: 'RES-2026-TFQ4',
        usuarioId: USER_ID,
        vehiculoId: created.id,
        estado: EstadoReserva.PENDIENTE_CONTACTO,
      },
    });

    const result = await updateVehicle(created.id, (current) => {
      const lock = vehicleLock(current);
      expect(lock).toBe('reserved');
      const hostile = {
        ...currentAsRaw(current),
        placa: 'HACK999',
        condicion: 'NUEVO',
        kilometraje: '0',
        color: 'Hackeado',
        disponibilidad: 'PROXIMAMENTE',
        precio: '1234.00',
        descripcion: 'Nueva descripción',
      };
      const parsed = schema.safeParse(buildEditRaw(current, hostile, lock));
      return parsed.success ? parsed.data : null;
    });
    expect(result.status).toBe('ok');

    const after = await getAdminVehicle(created.id);
    expect(after).toMatchObject({
      placa: data.placa,
      condicion: 'USADO',
      color: data.color,
      disponibilidad: 'RESERVADO',
      precio: '1234.00',
      descripcion: 'Nueva descripción',
    });
    expect(await setVehicleVisibility(created.id, false)).toEqual({ status: 'locked' });
    expect(await setVehicleVisibility(created.id, true)).toEqual({ status: 'ok' });
  });

  it('un vehículo VENDIDO no se edita ni se muestra/oculta', async () => {
    modeloId = (await prisma.modelo.findFirstOrThrow({ where: { activo: true } })).id;
    const created = await createVehicle(input());
    if (created.status !== 'ok') throw new Error('no se creó');
    await prisma.vehiculo.update({
      where: { id: created.id },
      data: { disponibilidad: 'VENDIDO', visibleCatalogo: false },
    });

    expect(await updateVehicle(created.id, () => input())).toEqual({ status: 'locked' });
    expect(await setVehicleVisibility(created.id, true)).toEqual({ status: 'locked' });
    expect(await setVehicleVisibility(created.id, false)).toEqual({ status: 'locked' });
    expect(await updateVehicle(4_000_000_000, () => input())).toEqual({ status: 'not_found' });
    expect(await setVehicleVisibility(4_000_000_000, true)).toEqual({ status: 'not_found' });
  });

  it('ocultar y mostrar un vehículo libre', async () => {
    modeloId = (await prisma.modelo.findFirstOrThrow({ where: { activo: true } })).id;
    const created = await createVehicle(input());
    if (created.status !== 'ok') throw new Error('no se creó');

    expect(await setVehicleVisibility(created.id, false)).toEqual({ status: 'ok' });
    expect((await getAdminVehicle(created.id))?.visibleCatalogo).toBe(false);
    expect(await setVehicleVisibility(created.id, true)).toEqual({ status: 'ok' });
    expect((await getAdminVehicle(created.id))?.visibleCatalogo).toBe(true);
  });

  it('el listado filtra por disponibilidad, visibilidad y condición', async () => {
    modeloId = (await prisma.modelo.findFirstOrThrow({ where: { activo: true } })).id;
    const used = await createVehicle(input());
    const brandNew = await createVehicle(
      input({ condicion: 'NUEVO', placa: '', kilometraje: '0', disponibilidad: 'PROXIMAMENTE' })
    );
    if (used.status !== 'ok' || brandNew.status !== 'ok') throw new Error('no se crearon');
    await setVehicleVisibility(used.id, false);

    const ids = async (f: Parameters<typeof listAdminVehicles>[0]) =>
      (await listAdminVehicles(f)).items.map((v) => v.id);
    const mine = (await ids({ page: 1, visible: false, condicion: 'USADO' })).filter(
      (id) => id === used.id
    );
    expect(mine).toEqual([used.id]);
    expect(
      (await ids({ page: 1, disponibilidad: 'PROXIMAMENTE', condicion: 'NUEVO' })).includes(
        brandNew.id
      )
    ).toBe(true);
    expect(
      (await ids({ page: 1, disponibilidad: 'PROXIMAMENTE', condicion: 'USADO' })).includes(
        brandNew.id
      )
    ).toBe(false);
  });

  it('el listado se pagina y acota las páginas fuera de rango', async () => {
    const first = await listAdminVehicles({ page: 1 });
    const outOfRange = await listAdminVehicles({ page: 99999 });
    expect(outOfRange.page).toBe(first.pageCount);
    expect((await listAdminVehicles({ page: -3 })).page).toBe(1);
  });
});

describe.skipIf(!dbUp)('marcas y modelos (BD)', () => {
  afterEach(cleanup);

  it('crear, renombrar y activar/desactivar marca y modelo', async () => {
    const brand = await createBrand(`${TAG}-A`);
    if (brand.status !== 'ok') throw new Error('no se creó');
    const model = await createModel(brand.id, `${TAG}-M`);
    if (model.status !== 'ok') throw new Error('no se creó');

    expect(await renameBrand(brand.id, `${TAG}-B`)).toEqual({ status: 'ok', id: brand.id });
    expect(await renameModel(model.id, `${TAG}-N`)).toEqual({ status: 'ok', id: model.id });
    expect(await setModelActive(model.id, false)).toEqual({ status: 'ok', id: model.id });
    expect(await setBrandActive(brand.id, false)).toEqual({ status: 'ok', id: brand.id });

    const listed = (await listBrandsWithModels()).find((b) => b.id === brand.id)!;
    expect(listed).toMatchObject({ nombre: `${TAG}-B`, activo: false });
    expect(listed.modelos[0]).toMatchObject({ nombre: `${TAG}-N`, activo: false });
    // Las desactivadas dejan de ofrecerse en el selector de vehículos
    expect((await listSelectableModels()).some((m) => m.id === model.id)).toBe(false);
  });

  it('nombres duplicados → duplicate (sin 500); mismo modelo en otra marca sí', async () => {
    const a = await createBrand(`${TAG}-X`);
    const b = await createBrand(`${TAG}-Y`);
    if (a.status !== 'ok' || b.status !== 'ok') throw new Error('no se crearon');

    expect(await createBrand(`${TAG}-X`)).toEqual({ status: 'duplicate' });
    expect(await renameBrand(b.id, `${TAG}-X`)).toEqual({ status: 'duplicate' });
    expect((await createModel(a.id, `${TAG}-M`)).status).toBe('ok');
    expect(await createModel(a.id, `${TAG}-M`)).toEqual({ status: 'duplicate' });
    expect((await createModel(b.id, `${TAG}-M`)).status).toBe('ok');
  });

  it('marca o modelo inexistente → not_found', async () => {
    expect(await createModel(4_000_000_000, `${TAG}-Z`)).toEqual({ status: 'not_found' });
    expect(await renameBrand(4_000_000_000, `${TAG}-Z`)).toEqual({ status: 'not_found' });
    expect(await setModelActive(4_000_000_000, true)).toEqual({ status: 'not_found' });
  });
});
