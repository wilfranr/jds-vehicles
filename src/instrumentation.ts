export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Una sola validación del entorno (F5-03): falla con un mensaje claro y sin imprimir valores secretos.
    const { assertRuntimeEnv } = await import('@/server/env');
    await assertRuntimeEnv();
  }
}

/**
 * Errores no controlados del servidor, con el formato unificado de registro. Solo nombre, `digest` (el mismo
 * identificador que ve el usuario en la página de error) y ruta: el mensaje puede contener datos personales o de
 * conexión y no se escribe.
 */
export async function onRequestError(
  error: unknown,
  request: { path: string; method: string },
  context: { routerKind: string; routePath: string; routeType: string }
) {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { logEvent } = await import('@/server/log');
  logEvent({
    channel: 'app',
    level: 'error',
    event: 'request_error',
    errorName: error instanceof Error ? error.name : 'Error',
    digest: (error as { digest?: string } | null)?.digest,
    method: request.method,
    route: context.routePath,
    routeType: context.routeType,
  });
}
