import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export function jsonError(error: unknown) {
  if (error instanceof ZodError) return NextResponse.json({ error: 'Validation failed', issues: error.flatten() }, { status: 400 });
  if (error instanceof Error && error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  if (error instanceof Error && error.message === 'FORBIDDEN') return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  console.error(JSON.stringify({ level: 'error', message: error instanceof Error ? error.message : 'Request failed' }));
  return NextResponse.json({ error: 'Request failed' }, { status: 500 });
}

export function pageArgs(url: string) {
  const query = new URL(url).searchParams;
  const page = Math.max(1, Number(query.get('page') || 1));
  const pageSize = Math.min(100, Math.max(1, Number(query.get('pageSize') || 20)));
  return { page, pageSize, skip: (page - 1) * pageSize };
}
