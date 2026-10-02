import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { jsonError } from '@/lib/http';

const schema = z.object({ name: z.string().trim().min(1).max(80) });
type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    await requireUser('menu.read', id);
    const categories = await db.menuCategory.findMany({
      where: { restaurantId: id },
      include: { _count: { select: { items: { where: { deletedAt: null } } } } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return NextResponse.json({ data: categories.map(category => ({ id: category.id, name: category.name, count: category._count.items })) });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    await requireUser('menu.write', id);
    const { name } = schema.parse(await request.json());
    const category = await db.menuCategory.create({ data: { restaurantId: id, name } });
    return NextResponse.json({ id: category.id, name: category.name, count: 0 }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return NextResponse.json({ error: 'That category already exists' }, { status: 409 });
    return jsonError(error);
  }
}
