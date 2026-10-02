import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { jsonError } from '@/lib/http';

type Context={params:Promise<{id:string;tableId:string}>};
export async function POST(_req:Request,ctx:Context){
  try{const {id,tableId}=await ctx.params;await requireUser('restaurants.write',id);const table=await db.diningTable.findFirst({where:{id:tableId,restaurantId:id},include:{qrCode:true,restaurant:true}});if(!table)return NextResponse.json({error:'Table not found'},{status:404});if(!table.qrCode)return NextResponse.json({error:'Table has no QR code assigned'},{status:409});const qr=await db.qRCode.update({where:{id:table.qrCode.id},data:{token:randomUUID(),status:'ACTIVE',regeneratedAt:new Date()}});await db.auditLog.create({data:{restaurantId:id,action:'table.qr_regenerated',objectType:'QRCode',objectId:qr.id,details:{tableLabel:table.label}}});return NextResponse.json({table:{id:table.id,label:table.label,restaurant:table.restaurant.name},qrCode:qr});}catch(error){return jsonError(error);}
}
