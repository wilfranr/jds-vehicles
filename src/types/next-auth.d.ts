import type { DefaultSession } from 'next-auth';
import type { Rol } from '@/types/auth';

// Auth.js tipa `User.id` como string y no admite sobrescribirlo con number: en la sesión el id viaja
// como string (cadena decimal) y `getCurrentUser()` lo convierte al `AuthUser.id` numérico.
declare module 'next-auth' {
  interface User {
    rol?: Rol;
  }

  interface Session {
    user: {
      id: string;
      rol: Rol;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: number;
    rol?: Rol;
  }
}
