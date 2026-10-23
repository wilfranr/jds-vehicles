import { PrismaClient } from '@prisma/client';

/** Comprueba que la ejecución completa de e2e no deja usuarios residuales en la BD. */
export default async function globalSetup() {
  const prisma = new PrismaClient();
  const before = await prisma.user.count();

  return async () => {
    const after = await prisma.user.count();
    await prisma.$disconnect();
    if (after !== before) {
      throw new Error(
        `Las pruebas e2e dejaron usuarios residuales: antes ${before}, después ${after}.`
      );
    }
  };
}
