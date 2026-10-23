export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { assertAuthEnv } = await import('@/server/auth/env');
    assertAuthEnv();
    const { assertReservationEnv } = await import('@/server/reservations/config');
    assertReservationEnv();
  }
}
