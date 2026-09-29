import { NextRequest, NextResponse } from 'next/server'; import { z } from 'zod'; import { createHmac, timingSafeEqual } from 'node:crypto'; import { db } from '@/lib/db'; import { jsonError } from '@/lib/http'; import { salesforceProvider } from '@/integrations/salesforce/provider';
const schema = z.object({ eventId: z.string().min(1), restaurant: z.object({ externalId: z.string().min(1), name: z.string().min(1), description: z.string().optional(), cuisine: z.array(z.string()).optional(), phone: z.string().optional(), email: z.string().email().optional(), website: z.string().optional(), address: z.string().optional(), city: z.string().optional(), state: z.string().optional(), country: z.string().optional(), pincode: z.string().optional() }) });
function authorized(req: NextRequest, raw: string) { const secret = process.env.SALESFORCE_WEBHOOK_SECRET; if (!secret) return process.env.NODE_ENV !== 'production'; const got = (req.headers.get('x-scanzaa-signature') || '').replace(/^sha256=/, ''); const expected = createHmac('sha256', secret).update(raw).digest('hex'); const a = Buffer.from(got); const b = Buffer.from(expected); return a.length === b.length && timingSafeEqual(a,b); }
export async function POST(req: NextRequest) {
 try {
  const raw = await req.text(); if (!authorized(req, raw)) return NextResponse.json({ error: 'Invalid integration signature' }, { status: 401 });
  const input = schema.parse(JSON.parse(raw));
  const old = await db.integrationEvent.findUnique({ where: { eventId: input.eventId } }); if (old?.status === 'SUCCEEDED') return NextResponse.json({ duplicate: true, result: 'already processed' });
  await db.integrationEvent.upsert({ where: { eventId: input.eventId }, create: { provider: 'salesforce', eventId: input.eventId, eventType: 'restaurant.upsert', payload: input, status: 'PROCESSING', attempts: 1 }, update: { status: 'PROCESSING', attempts: { increment: 1 }, error: null } });
  try {
    const source = input.restaurant; const exists = await db.restaurant.findUnique({ where: { externalId: source.externalId } });
    await (exists ? salesforceProvider.updateRestaurant(source) : salesforceProvider.createRestaurant(source));
    const data = { name: source.name, description: source.description, cuisine: source.cuisine || [], phone: source.phone, email: source.email, website: source.website, address: source.address, city: source.city, state: source.state, country: source.country || 'India' };
    const result = await db.restaurant.upsert({ where: { externalId: source.externalId }, create: { ...data, externalId: source.externalId, slug: `${source.name.toLowerCase().replace(/[^a-z0-9]+/g,'-')}-${crypto.randomUUID().slice(0,6)}`, status: 'ONBOARDING' }, update: data });
    await db.integrationEvent.update({ where: { eventId: input.eventId }, data: { status: 'SUCCEEDED', processedAt: new Date() } });
    return NextResponse.json({ result: exists ? 'updated' : 'created', restaurant: result });
  } catch (error) { await db.integrationEvent.update({ where: { eventId: input.eventId }, data: { status: 'FAILED', error: error instanceof Error ? error.message : 'Processing failed' } }); throw error; }
 } catch(e) { return jsonError(e); }
}
