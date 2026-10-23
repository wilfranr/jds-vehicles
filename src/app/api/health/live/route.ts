import { NextResponse } from 'next/server';

/** Solo confirma que el proceso responde (sin BD ni disco): para el reinicio automático, que no debe reiniciar la app por una BD caída. */
export function GET() {
  return NextResponse.json({ status: 'ok' }, { headers: { 'Cache-Control': 'no-store' } });
}
