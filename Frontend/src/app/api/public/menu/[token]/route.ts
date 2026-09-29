import { NextResponse } from 'next/server'; import { db } from '@/lib/db';
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const qr = await db.qRCode.findUnique({ where: { token }, include: { table: { include: { restaurant: true } } } });
  if (!qr || qr.status !== 'ACTIVE' || !qr.table.isActive || qr.table.restaurant.status !== 'ACTIVE' || !qr.table.restaurant.menuEnabled) return NextResponse.json({ error: 'This menu is unavailable' }, { status: 404 });
  const restaurant = qr.table.restaurant;
  const [categories, items] = await Promise.all([
    db.menuCategory.findMany({ where: { restaurantId: restaurant.id, isActive: true }, orderBy: { sortOrder: 'asc' } }),
    db.menuItem.findMany({ where: { restaurantId: restaurant.id, available: true, deletedAt: null }, orderBy: { name: 'asc' } }),
  ]);
  await db.qRCode.update({ where: { id: qr.id }, data: { scansTotal: { increment: 1 } } });
  return NextResponse.json({ restaurant, table: qr.table, categories, items });
}
