// @vitest-environment node
import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTempDatabase, type TempDatabase } from '@/test-utils/temp-db';

// `pnpm db:verificar` debe fallar si el esquema de Prisma y las migraciones divergen (F5-03). Se prueba en una BD
// temporal con las migraciones aplicadas: sin cambios → 0; con una columna extra fuera de las migraciones → 2.
const run = promisify(execFile);
const prismaBin = path.resolve('node_modules/.bin/prisma');
let temp: TempDatabase | null = null;

beforeAll(async () => {
  temp = await createTempDatabase();
  if (!temp && process.env.CI)
    throw new Error('La verificación de migraciones necesita una BD temporal en CI.');
});
afterAll(async () => {
  await temp?.drop();
});

async function verify(url: string) {
  try {
    await run(
      prismaBin,
      [
        'migrate',
        'diff',
        '--from-schema-datasource',
        'prisma/schema.prisma',
        '--to-schema-datamodel',
        'prisma/schema.prisma',
        '--exit-code',
      ],
      { env: { ...process.env, DATABASE_URL: url }, timeout: 120_000 }
    );
    return 0;
  } catch (error) {
    return (error as { code?: number }).code ?? 1;
  }
}

describe('verificación de migraciones', () => {
  it('las migraciones aplicadas coinciden con schema.prisma (código 0)', async (ctx) => {
    if (!temp) return ctx.skip();
    expect(await verify(temp.url)).toBe(0);
  }, 180_000);

  it('una divergencia (columna fuera de las migraciones) hace fallar la verificación (código 2)', async (ctx) => {
    if (!temp) return ctx.skip();
    await temp.prisma.$executeRawUnsafe('ALTER TABLE marcas ADD COLUMN divergente INT NULL');
    expect(await verify(temp.url)).toBe(2);
  }, 180_000);
});
