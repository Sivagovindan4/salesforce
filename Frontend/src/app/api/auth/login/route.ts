import { NextRequest, NextResponse } from 'next/server';
import { scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { z } from 'zod';
import { db } from '@/lib/db';
import { setSession } from '@/lib/auth';
import { jsonError } from '@/lib/http';
const scrypt = promisify(scryptCb);
const schema = z.object({ email: z.string().email(), password: z.string().min(1) });
export async function POST(req: NextRequest) {
  try {
    const input = schema.parse(await req.json());
    const user = await db.user.findUnique({ where: { email: input.email.toLowerCase() } });
    if (!user || !user.passwordHash.includes(':')) return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    const [salt, stored] = user.passwordHash.split(':');
    const derived = await scrypt(input.password, salt, 64) as Buffer; const expected = Buffer.from(stored, 'hex');
    if (expected.length !== derived.length || !timingSafeEqual(expected, derived) || user.status !== 'ACTIVE') return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const response = NextResponse.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } }); setSession(response, user.id); return response;
  } catch (error) { return jsonError(error); }
}
