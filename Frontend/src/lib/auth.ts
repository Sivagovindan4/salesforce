import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

const COOKIE = 'scanzaa_session';
const secret = () => process.env.SESSION_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'development-only-session-secret-change-me');
export function issueSession(userId: string) {
  const key = secret(); if (!key) throw new Error('SESSION_SECRET is required');
  const payload = Buffer.from(JSON.stringify({ userId, exp: Date.now() + 1000 * 60 * 60 * 12 })).toString('base64url');
  const signature = createHmac('sha256', key).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}
export function setSession(response: NextResponse, userId: string) {
  response.cookies.set(COOKIE, issueSession(userId), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 12 });
}
export async function currentUser() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const [payload, signature] = token.split('.'); const key = secret();
  if (!payload || !signature || !key) return null;
  const expected = createHmac('sha256', key).update(payload).digest();
  let actual: Buffer; try { actual = Buffer.from(signature, 'base64url'); } catch { return null; }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { userId: string; exp: number };
    if (data.exp < Date.now()) return null;
    return db.user.findUnique({ where: { id: data.userId }, include: { roleAssignments: { include: { permission: true } } } });
  } catch { return null; }
}
export async function requireUser(permission?: string) {
  const user = await currentUser();
  if (!user || user.status !== 'ACTIVE') throw new Error('UNAUTHORIZED');
  const globalAdmin = user.role === 'SUPER_ADMIN' || user.role === 'COMPANY_ADMIN';
  const allowed = user.roleAssignments.some(x => x.permission.key === permission);
  if (permission && !globalAdmin && !allowed) throw new Error('FORBIDDEN');
  return user;
}
