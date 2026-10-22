/**
 * Falla con un mensaje claro si falta `AUTH_SECRET` en producción.
 * No se exige durante `next build` (fase de compilación), solo al arrancar el servidor.
 */
export function assertAuthEnv(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV !== 'production') return;
  if (env.NEXT_PHASE === 'phase-production-build') return;

  const secret = env.AUTH_SECRET ?? env.NEXTAUTH_SECRET;
  if (!secret || secret.trim().length === 0) {
    throw new Error(
      'Falta la variable de entorno AUTH_SECRET. Genérala con `openssl rand -base64 32` y defínela antes de arrancar en producción.'
    );
  }
}
