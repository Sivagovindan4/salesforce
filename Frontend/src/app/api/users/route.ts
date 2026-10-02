import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma, UserRole } from '@prisma/client';
import { z } from 'zod';
import { db } from '@/lib/db';
import { accessibleRestaurantIds, isGlobalAdmin, requireUser } from '@/lib/auth';
import { jsonError } from '@/lib/http';

const scrypt = promisify(scryptCallback);
const roleByLabel = {
  'Company Admin': UserRole.COMPANY_ADMIN,
  'Company Restaurant Manager': UserRole.COMPANY_RESTAURANT_MANAGER,
  'Restaurant Admin': UserRole.RESTAURANT_ADMIN,
  'Restaurant Staff': UserRole.RESTAURANT_STAFF,
} as const;
const permissionKeySchema = z.enum(['restaurants.read', 'restaurants.write', 'menu.read', 'menu.write', 'orders.read', 'orders.write', 'reviews.read', 'reports.read', 'users.write']);
const profileSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().transform(value => value.toLowerCase()),
  role: z.enum(['Company Admin', 'Company Restaurant Manager', 'Restaurant Admin', 'Restaurant Staff']),
  restaurantIds: z.array(z.string()).max(50).default([]),
  permissions: z.array(permissionKeySchema).max(9),
});
const createSchema = profileSchema.extend({ password: z.string().min(8).max(128) });
const updateSchema = profileSchema.extend({ password: z.union([z.string().min(8).max(128), z.literal('')]).optional() });

function roleLabel(role: UserRole) {
  return role === UserRole.COMPANY_RESTAURANT_MANAGER ? 'Company Restaurant Manager' : role.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, value => value.toUpperCase());
}

async function savePermissions(userId: string, permissions: string[], transaction: Prisma.TransactionClient) {
  await transaction.roleAssignment.deleteMany({ where: { userId } });
  for (const key of permissions) {
    const permission = await transaction.permission.upsert({
      where: { key },
      create: { key, description: `Permission to ${key.replace('.', ' ')}` },
      update: {},
    });
    await transaction.roleAssignment.create({ data: { userId, permissionId: permission.id } });
  }
}

async function validateRestaurants(role: UserRole, restaurantIds: string[]) {
  if (role !== UserRole.COMPANY_ADMIN && restaurantIds.length === 0) {
    return NextResponse.json({ error: 'Choose at least one restaurant for this role' }, { status: 400 });
  }
  const uniqueIds = [...new Set(restaurantIds)];
  if (uniqueIds.length !== restaurantIds.length) return NextResponse.json({ error: 'A restaurant was selected more than once' }, { status: 400 });
  const found = await db.restaurant.count({ where: { id: { in: uniqueIds }, deletedAt: null } });
  if (found !== uniqueIds.length) {
    return NextResponse.json({ error: 'One or more selected restaurants were not found' }, { status: 404 });
  }
  return null;
}

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = await scrypt(password, salt, 64) as Buffer;
  return `${salt}:${hash.toString('hex')}`;
}

export async function GET() {
  try {
    const actor = await requireUser('users.write');
    const scope = accessibleRestaurantIds(actor);
    const where = scope ? { role: { notIn: [UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN] }, memberships: { some: { restaurantId: { in: scope }, status: 'ACTIVE' as const } } } : {};
    const users = await db.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        roleAssignments: { include: { permission: { select: { key: true } } } },
        memberships: { include: { restaurant: { select: { name: true } } } },
      },
    });
    const visibleUsers = scope ? users.filter(user => user.memberships.every(membership => scope.includes(membership.restaurantId))) : users;
    return NextResponse.json({ data: visibleUsers.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: roleLabel(user.role),
      restaurant: user.memberships.map(membership => membership.restaurant.name).join(', ') || 'All restaurants',
      restaurantId: user.memberships[0]?.restaurantId || '',
      restaurantIds: user.memberships.map(membership => membership.restaurantId),
      permissions: user.roleAssignments.map(assignment => assignment.permission.key),
      status: user.status === 'ACTIVE' ? 'Active' : user.status[0] + user.status.slice(1).toLowerCase(),
      last: user.lastLoginAt ? user.lastLoginAt.toLocaleString() : 'Never',
    })) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireUser('users.write');
    const input = createSchema.parse(await req.json());
    const role = roleByLabel[input.role];
    const scope = accessibleRestaurantIds(actor);
    if ((!isGlobalAdmin(actor) && role === UserRole.COMPANY_ADMIN) || (scope && input.restaurantIds.some(id => !scope.includes(id)))) return NextResponse.json({ error: 'You can only assign restaurants within your own access' }, { status: 403 });
    if (role !== UserRole.COMPANY_ADMIN && input.permissions.length === 0) {
      return NextResponse.json({ error: 'Grant access to at least one page' }, { status: 400 });
    }
    const invalidRestaurant = await validateRestaurants(role, input.restaurantIds);
    if (invalidRestaurant) return invalidRestaurant;
    const user = await db.$transaction(async transaction => {
      const created = await transaction.user.create({
        data: { name: input.name, email: input.email, passwordHash: await hashPassword(input.password), role, status: 'ACTIVE' },
      });
      if (input.restaurantIds.length) await transaction.restaurantUser.createMany({ data: [...new Set(input.restaurantIds)].map(restaurantId => ({ userId: created.id, restaurantId, permissions: [] })) });
      await savePermissions(created.id, input.permissions, transaction);
      return created;
    });
    return NextResponse.json({ id: user.id, name: user.name, email: user.email, role: roleLabel(user.role), status: 'Active' }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'A member with this email already exists' }, { status: 409 });
    }
    return jsonError(error);
  }
}
