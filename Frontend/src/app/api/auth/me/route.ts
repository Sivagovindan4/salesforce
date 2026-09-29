import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
export async function GET() { const user = await currentUser(); return user ? NextResponse.json({ id: user.id, name: user.name, email: user.email, role: user.role, permissions: user.roleAssignments.map(x => x.permission.key) }) : NextResponse.json({ error: 'Authentication required' }, { status: 401 }); }
