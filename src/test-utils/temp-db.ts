import { randomBytes } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

/**
 * Base de datos TEMPORAL para pruebas que necesitan un estado que la BD de desarrollo no tiene (p. ej. «ningún
 * administrador») o que son destructivas. Crea `jds_test_<aleatorio>` en el mismo servidor, aplica las migraciones
 * de `prisma/migrations` y se elimina con `drop()`. **Nunca toca la base de datos de desarrollo.**
 *
 * Necesita permiso para crear bases de datos: en local el usuario de desarrollo lo tiene; en CI se usa
 * `TEST_DB_ADMIN_URL` (usuario root del servicio MySQL). Sin permiso, `createTempDatabase` devuelve `null`.
 */
export interface TempDatabase {
  name: string;
  url: string;
  prisma: PrismaClient;
  /** Inserta los tres roles de referencia (CLIENTE, ADMIN, ASESOR) con los mismos ids que el seed. */
  seedRoles: () => Promise<void>;
  drop: () => Promise<void>;
}

function withDatabase(rawUrl: string, database: string): string {
  const url = new URL(rawUrl);
  url.pathname = `/${database}`;
  return url.toString();
}

function migrationStatements(): string[] {
  const root = path.resolve('prisma/migrations');
  const directories = readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const statements: string[] = [];
  for (const directory of directories) {
    const sql = readFileSync(path.join(root, directory, 'migration.sql'), 'utf8')
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n');
    for (const statement of sql.split(/;\s*(?:\n|$)/)) {
      if (statement.trim()) statements.push(statement.trim());
    }
  }
  return statements;
}

export async function createTempDatabase(): Promise<TempDatabase | null> {
  const baseUrl = process.env.TEST_DB_ADMIN_URL ?? process.env.DATABASE_URL;
  if (!baseUrl) return null;
  const name = `jds_test_${randomBytes(5).toString('hex')}`;

  const admin = new PrismaClient({ datasourceUrl: baseUrl });
  try {
    await admin.$executeRawUnsafe(
      `CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
  } catch {
    await admin.$disconnect();
    return null;
  }

  const url = withDatabase(baseUrl, name);
  const prisma = new PrismaClient({ datasourceUrl: url });
  try {
    for (const statement of migrationStatements()) await prisma.$executeRawUnsafe(statement);
  } catch (error) {
    await prisma.$disconnect();
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS \`${name}\``);
    await admin.$disconnect();
    throw error;
  }

  return {
    name,
    url,
    prisma,
    seedRoles: async () => {
      await prisma.$executeRawUnsafe(
        "INSERT INTO roles (id, nombre, descripcion) VALUES (1,'CLIENTE','Cliente'),(2,'ADMIN','Administrador'),(3,'ASESOR','Asesor')"
      );
    },
    drop: async () => {
      await prisma.$disconnect();
      await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS \`${name}\``);
      await admin.$disconnect();
    },
  };
}
