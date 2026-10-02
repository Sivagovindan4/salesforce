import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { jsonError } from '@/lib/http';

const schema = z.object({ name: z.string().trim().min(1).max(80) });
type Context = { params: Promise<{ id: string; categoryId: string }> };

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const { id, categoryId } = await context.params;
    await requireUser('menu.write', id);
    const { name } = schema.parse(await request.json());
    const category = await db.menuCategory.update({ where: { id: categoryId, restaurantId: id }, data: { name } });
    return NextResponse.json({ id: category.id, name: category.name });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return NextResponse.json({ error: 'That category already exists' }, { status: 409 });
    return jsonError(error);
  }
}

export async function DELETE(_request: NextRequest, context: Context) {
  try {
    const { id, categoryId } = await context.params;
    await requireUser('menu.write', id);
    await db.menuCategory.delete({ where: { id: categoryId, restaurantId: id } });
    return NextResponse.json({ ok: true });
  } catch (error) { return jsonError(error); }
}
