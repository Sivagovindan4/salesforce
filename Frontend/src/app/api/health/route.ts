import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
export async function GET() {
  let database = 'disconnected'; try { await db.$queryRaw`SELECT 1`; database = 'connected'; } catch { /* report readiness without leaking connection details */ }
  return NextResponse.json({ status: database === 'connected' ? 'ok' : 'degraded', database, environment: process.env.NODE_ENV, version: process.env.npm_package_version || '1.0.0' }, { status: database === 'connected' ? 200 : 503 });
}
