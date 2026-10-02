import { Prisma, UserRole } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { accessibleRestaurantIds, isGlobalAdmin, requireUser } from '@/lib/auth';
import { jsonError } from '@/lib/http';

const roleByLabel = {
  'Company Admin': UserRole.COMPANY_ADMIN,
  'Company Restaurant Manager': UserRole.COMPANY_RESTAURANT_MANAGER,
  'Restaurant Admin': UserRole.RESTAURANT_ADMIN,
  'Restaurant Staff': UserRole.RESTAURANT_STAFF,
} as const;
const permissionKeySchema = z.enum(['restaurants.read', 'restaurants.write', 'menu.read', 'menu.write', 'orders.read', 'orders.write', 'reviews.read', 'reports.read', 'users.write']);
const schema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().transform(value => value.toLowerCase()),
  role: z.enum(['Company Admin', 'Company Restaurant Manager', 'Restaurant Admin', 'Restaurant Staff']),
  restaurantIds: z.array(z.string()).max(50).default([]),
  permissions: z.array(permissionKeySchema).max(9),
  password: z.union([z.string().min(8).max(128), z.literal('')]).optional(),
});
const scrypt = async (password: string) => {
  const { randomBytes, scrypt: scryptCallback } = await import('node:crypto');
  const salt = randomBytes(16).toString('hex');
  const hash = await new Promise<Buffer>((resolve, reject) => scryptCallback(password, salt, 64, (error, result) => error ? reject(error) : resolve(result as Buffer)));
  return `${salt}:${hash.toString('hex')}`;
};

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireUser('users.write');
    const { id } = await context.params;
    const input = schema.parse(await req.json());
    const role = roleByLabel[input.role];
    const scope = accessibleRestaurantIds(actor);
    const target = await db.user.findUnique({ where: { id }, include: { memberships: { select: { restaurantId: true } } } });
    if (!target) return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    if (scope && (target.role === UserRole.SUPER_ADMIN || target.role === UserRole.COMPANY_ADMIN || target.memberships.some(membership => !scope.includes(membership.restaurantId)))) return NextResponse.json({ error: 'You can only edit members assigned within your restaurant access' }, { status: 403 });
    if ((!isGlobalAdmin(actor) && role === UserRole.COMPANY_ADMIN) || (scope && input.restaurantIds.some(restaurantId => !scope.includes(restaurantId)))) return NextResponse.json({ error: 'You can only assign restaurants within your own access' }, { status: 403 });
    if (role !== UserRole.COMPANY_ADMIN && input.permissions.length === 0) {
      return NextResponse.json({ error: 'Grant access to at least one page' }, { status: 400 });
    }
    if (role !== UserRole.COMPANY_ADMIN && input.restaurantIds.length === 0) {
      return NextResponse.json({ error: 'Choose at least one restaurant for this role' }, { status: 400 });
    }
    const restaurantIds = [...new Set(input.restaurantIds)];
    if (restaurantIds.length !== input.restaurantIds.length) return NextResponse.json({ error: 'A restaurant was selected more than once' }, { status: 400 });
    if (await db.restaurant.count({ where: { id: { in: restaurantIds }, deletedAt: null } }) !== restaurantIds.length) {
      return NextResponse.json({ error: 'One or more selected restaurants were not found' }, { status: 404 });
    }
    const data = await db.$transaction(async transaction => {
      const updated = await transaction.user.update({
        where: { id },
        data: { name: input.name, email: input.email, role, ...(input.password ? { passwordHash: await scrypt(input.password) } : {}) },
      });
      await transaction.restaurantUser.deleteMany({ where: { userId: id } });
      if (restaurantIds.length) await transaction.restaurantUser.createMany({ data: restaurantIds.map(restaurantId => ({ userId: id, restaurantId, permissions: [] })) });
      await transaction.roleAssignment.deleteMany({ where: { userId: id } });
      for (const key of input.permissions) {
        const permission = await transaction.permission.upsert({
          where: { key },
          create: { key, description: `Permission to ${key.replace('.', ' ')}` },
          update: {},
        });
        await transaction.roleAssignment.create({ data: { userId: id, permissionId: permission.id } });
      }
      return updated;
    });
    await db.auditLog.create({ data: { actorId: actor.id, action: 'user.updated', objectType: 'User', objectId: id } });
    return NextResponse.json({ id: data.id, name: data.name, email: data.email, role: input.role });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'A member with this email already exists' }, { status: 409 });
    }
    return jsonError(error);
  }
}
