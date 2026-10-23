import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { isRol, type Rol } from '@/types/auth';
import { safeNextPath } from '@/lib/safe-redirect';
import { buildLoginUrl } from '@/server/auth/next-path';
import { decideAccess } from '@/server/security/access';
import { getClientIp } from '@/server/security/client-ip';
import { logSecurityEvent } from '@/server/security/audit';

/**
 * Primera barrera de acceso (defensa en profundidad), NO la única:
 * - Solo decodifica el JWT de la cookie; no consulta la base de datos.
 * - Por eso el rol puede estar obsoleto: el JWT dura hasta 7 días y no se revoca si se desactiva al usuario
 *   o se le cambia el rol. Cada página y acción privada debe volver a comprobar con `requireUser()` /
 *   `requireRole()` y toda operación sensible (cambio de contraseña, reservas, panel) con `getFreshUser()`
 *   (`src/server/auth/index.ts`), que consulta la BD.
 * - Las Server Actions son POST a la ruta de la página, así que este proxy también las filtra, pero no
 *   sustituye la comprobación dentro de la acción.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isProduction = process.env.NODE_ENV === 'production';

  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    secureCookie: isProduction,
  });
  const rol: Rol | null = token && isRol(token.rol) ? token.rol : null;

  switch (decideAccess(pathname, rol)) {
    case 'redirectLogin':
      return NextResponse.redirect(new URL(buildLoginUrl(`${pathname}${search}`), request.url));
    case 'redirectAuthenticated':
      return NextResponse.redirect(
        new URL(safeNextPath(request.nextUrl.searchParams.get('next')), request.url)
      );
    case 'notFound':
      logSecurityEvent({
        type: 'forbidden_access',
        userId: typeof token?.id === 'number' ? token.id : undefined,
        ip: getClientIp(request.headers),
        detail: pathname,
      });
      // Se reescribe a una ruta inexistente: responde 404 con la página de no encontrado del sitio.
      return NextResponse.rewrite(new URL('/404-not-found', request.url), { status: 404 });
    default:
      return NextResponse.next();
  }
}

// Solo `/login` (redirige si ya hay sesión) y las rutas privadas: no se ejecuta sobre `/_next/**`, imágenes, archivos públicos ni `/api/auth/**`.
export const config = {
  matcher: ['/login', '/mi-cuenta/:path*', '/admin/:path*'],
};
