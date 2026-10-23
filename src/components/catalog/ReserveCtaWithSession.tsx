import React, { Suspense } from 'react';
import { getCurrentUser } from '@/server/auth';
import { ReserveCta } from './ReserveCta';

type ReserveCtaProps = React.ComponentProps<typeof ReserveCta>;

async function ReserveCtaForCurrentUser(props: Omit<ReserveCtaProps, 'isAuthenticated'>) {
  const user = await getCurrentUser();
  return <ReserveCta {...props} isAuthenticated={user !== null} />;
}

/**
 * Lee la sesión aislada en `<Suspense>` para que el resto del detalle del vehículo no dependa de ella.
 * El fallback es la variante sin sesión (enlace a iniciar sesión), que también sirve sin JavaScript.
 */
export function ReserveCtaWithSession(props: Omit<ReserveCtaProps, 'isAuthenticated'>) {
  return (
    <Suspense fallback={<ReserveCta {...props} isAuthenticated={false} />}>
      <ReserveCtaForCurrentUser {...props} />
    </Suspense>
  );
}
