import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    // Verificar conectividad con MySQL ejecutando SELECT 1
    await prisma.$queryRawUnsafe('SELECT 1');

    return NextResponse.json(
      {
        status: 'ok',
        db: 'up',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Health check error - database unavailable:', error);

    return NextResponse.json(
      {
        status: 'error',
        db: 'down',
      },
      { status: 503 }
    );
  }
}
