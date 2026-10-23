import NextAuth, { type Session } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { verifyCredentials } from '@/server/auth/verify-credentials';
import { isRol } from '@/types/auth';

/**
 * Sesión JWT (obligatoria con el proveedor Credentials):
 * - Duración máxima: 7 días.
 * - Renovación deslizante: el token se reemite como mucho cada 24 h de actividad.
 */
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
const SESSION_UPDATE_AGE_SECONDS = 24 * 60 * 60;

const isProduction = process.env.NODE_ENV === 'production';

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Pantallas propias: evita la página genérica de Auth.js (sin marca ni límites de intentos).
  pages: { signIn: '/login', error: '/login' },
  // Detrás de un proxy inverso (servidor Oracle) se define AUTH_TRUST_HOST=true.
  trustHost: process.env.AUTH_TRUST_HOST === 'true' || !isProduction,
  session: {
    strategy: 'jwt',
    maxAge: SESSION_MAX_AGE_SECONDS,
    updateAge: SESSION_UPDATE_AGE_SECONDS,
  },
  // Cookies HttpOnly + SameSite=Lax; Secure solo en producción (HTTPS).
  useSecureCookies: isProduction,
  cookies: {
    sessionToken: {
      options: { httpOnly: true, sameSite: 'lax', path: '/', secure: isProduction },
    },
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Correo', type: 'email' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials) {
        const user = await verifyCredentials(credentials?.email, credentials?.password, {
          findUserByEmail: (email) =>
            prisma.user.findUnique({ where: { email }, include: { rol: true } }),
          comparePassword: (plain, hash) => bcrypt.compare(plain, hash),
        });
        if (!user) return null;
        return { id: String(user.id), name: user.name, email: user.email, rol: user.rol };
      },
    }),
  ],
  callbacks: {
    // Solo id, rol, nombre y correo: nunca hash, documento ni teléfono.
    jwt({ token, user }) {
      if (user) {
        token.id = Number(user.id);
        token.rol = user.rol;
      }
      return token;
    },
    session({ session, token }) {
      if (typeof token.id !== 'number' || !isRol(token.rol)) return session;
      // Objeto nuevo y explícito: solo los campos públicos (el id va como string por el tipado de Auth.js).
      const next: Session = {
        expires: session.expires,
        user: {
          id: String(token.id),
          rol: token.rol,
          name: session.user.name,
          email: session.user.email,
        },
      };
      return next;
    },
  },
});
