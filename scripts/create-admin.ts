/**
 * Crea el PRIMER administrador (F5-03):  pnpm admin:crear
 *
 * Los datos se piden por consola, o se leen de variables: ADMIN_NAME (nombres), ADMIN_LASTNAME, ADMIN_EMAIL,
 * ADMIN_DOCUMENT_TYPE (CC|CE|NIT|PASAPORTE), ADMIN_DOCUMENT y ADMIN_PHONE. La contraseña se pide por **entrada
 * oculta**; solo con el flag explícito `--password-from-env` se lee de `ADMIN_PASSWORD` (para automatizar). Nunca
 * se imprime. Se niega si ya existe un ADMIN. Códigos de salida: 0 creado, 2 ya existía, 1 error o datos inválidos.
 */
import { createInterface } from 'node:readline/promises';
import { PrismaClient } from '@prisma/client';
import { createFirstAdmin, type FirstAdminInput } from '../src/server/admin/first-admin';

const ask = async (rl: ReturnType<typeof createInterface>, label: string, env?: string) =>
  env?.trim() ? env.trim() : (await rl.question(`${label}: `)).trim();

/** Lee una línea sin mostrarla (modo crudo del terminal). */
function readHidden(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    if (!stdin.isTTY) {
      reject(new Error('No hay terminal interactivo: use --password-from-env con ADMIN_PASSWORD.'));
      return;
    }
    process.stdout.write(`${prompt}: `);
    let value = '';
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === '\u0003') {
          stdin.setRawMode(false);
          process.stdout.write('\n');
          process.exit(130);
        }
        if (char === '\r' || char === '\n') {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.removeListener('data', onData);
          process.stdout.write('\n');
          resolve(value);
          return;
        }
        if (char === '\u007f' || char === '\b') value = value.slice(0, -1);
        else value += char;
      }
    };
    stdin.on('data', onData);
  });
}

async function main(): Promise<number> {
  const fromEnv = process.argv.includes('--password-from-env');
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  let input: FirstAdminInput;
  try {
    const nombre = await ask(rl, 'Nombres', process.env.ADMIN_NAME);
    const apellido = await ask(rl, 'Apellidos', process.env.ADMIN_LASTNAME);
    const tipoDocumento = (
      await ask(rl, 'Tipo de documento (CC, CE, NIT, PASAPORTE)', process.env.ADMIN_DOCUMENT_TYPE)
    ).toUpperCase();
    const documento = await ask(rl, 'Número de documento', process.env.ADMIN_DOCUMENT);
    const email = await ask(rl, 'Correo electrónico', process.env.ADMIN_EMAIL);
    const telefono = await ask(rl, 'Celular colombiano', process.env.ADMIN_PHONE);
    rl.close();

    let password: string;
    if (fromEnv) {
      password = process.env.ADMIN_PASSWORD ?? '';
    } else {
      password = await readHidden('Contraseña (10 a 72 caracteres, con letra y número)');
      const again = await readHidden('Repite la contraseña');
      if (password !== again) {
        console.error('Las contraseñas no coinciden.');
        return 1;
      }
    }
    input = { nombre, apellido, tipoDocumento, documento, email, telefono, password };
  } catch (error) {
    rl.close();
    console.error(error instanceof Error ? error.message : 'No se pudieron leer los datos.');
    return 1;
  }

  const prisma = new PrismaClient();
  try {
    const result = await createFirstAdmin(prisma, input);
    switch (result.status) {
      case 'ok':
        console.log(
          `Administrador creado (id ${result.id}). Inicia sesión en /login con tu correo y tu contraseña.`
        );
        return 0;
      case 'exists':
        console.error(
          'Ya existe un administrador: este comando solo crea el primero. Usa «Usuarios» en el panel.'
        );
        return 2;
      case 'roles_missing':
        console.error(
          'Faltan los roles de referencia: ejecuta primero `pnpm db:seed` (en producción solo siembra datos de referencia).'
        );
        return 1;
      case 'duplicate':
        console.error('El correo o el documento ya pertenecen a otro usuario.');
        return 1;
      case 'invalid':
        console.error('Datos inválidos:');
        for (const [field, message] of Object.entries(result.fieldErrors)) {
          if (field === 'confirmPassword' || field === 'consentimiento') continue;
          console.error(`  - ${field}: ${message}`);
        }
        return 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error instanceof Error ? error.name : 'Error inesperado');
    process.exit(1);
  }
);
