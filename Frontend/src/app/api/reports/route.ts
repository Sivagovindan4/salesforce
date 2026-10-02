import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { accessibleRestaurantIds, requireUser } from '@/lib/auth';
import { jsonError } from '@/lib/http';

function period(range: string, customFrom?:string|null, customTo?:string|null) {
  if (customFrom && customTo) {
    const start = new Date(customFrom); const end = new Date(customTo);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && start <= end) return { start, end };
  }
  if (range === 'Custom range') throw new Error('INVALID_REPORT_DATE_RANGE');
  const end = new Date(); const start = new Date(end);
  start.setHours(0,0,0,0);
  if (range === 'Today') { /* start is already local midnight */ }
  else if (range === 'Last 7 days') start.setDate(start.getDate()-6);
  else if (range === 'Last 30 days') start.setDate(start.getDate()-29);
  else if (range === 'This month') start.setDate(1);
  else start.setDate(start.getDate()-6);
  return { start, end };
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser('reports.read', req.nextUrl.searchParams.get('restaurantId') || undefined);
    const scope = accessibleRestaurantIds(user);
    const type=req.nextUrl.searchParams.get('type')||'Restaurant performance';
    const restaurantId=req.nextUrl.searchParams.get('restaurantId')||undefined;
    const range=req.nextUrl.searchParams.get('range')||'Last 7 days';
    const {start,end}=period(range,req.nextUrl.searchParams.get('from'),req.nextUrl.searchParams.get('to'));
    const restaurantWhere={deletedAt:null,...(scope?{id:{in:scope}}:{}),...(restaurantId?{id:restaurantId}:{})};
    let data: Array<Record<string, string|number|boolean|null>>=[];
    if(type==='Restaurant performance'||type==='QR scan report') {
      const rows=await db.restaurant.findMany({where:restaurantWhere,include:{tables:{include:{qrCode:true}},_count:{select:{menuItems:true,orders:true,reviews:true}}},orderBy:{name:'asc'}});
      data=type==='QR scan report'?rows.flatMap(r=>r.tables.map(t=>({Restaurant:r.name,Table:t.label,QR_Status:t.qrCode?.status||'MISSING',Scans:t.qrCode?.scansTotal||0,Created_At:t.createdAt.toISOString()}))):rows.map(r=>({Restaurant:r.name,City:r.city||'',Status:r.status,Tables:r.tables.length,Menu_Items:r._count.menuItems,Orders:r._count.orders,Reviews:r._count.reviews,Scans:r.tables.reduce((sum,t)=>sum+(t.qrCode?.scansTotal||0),0)}));
    } else if(type==='Order report') {
      const orders=await db.order.findMany({where:{...(scope?{restaurantId:{in:scope}}:{}),...(restaurantId?{restaurantId}:{}),createdAt:{gte:start,lte:end}},include:{restaurant:true,table:true,items:true},orderBy:{createdAt:'desc'}});
      data=orders.map(o=>({Order:o.displayId,Restaurant:o.restaurant.name,Table:o.table?.label||'',Status:o.status,Items:o.items.reduce((n,x)=>n+x.quantity,0),Amount:Number(o.total),Created_At:o.createdAt.toISOString()}));
    } else if(type==='Menu report') {
      const items=await db.menuItem.findMany({where:{deletedAt:null,updatedAt:{gte:start,lte:end},...(scope?{restaurantId:{in:scope}}:{}),...(restaurantId?{restaurantId}:{})},include:{restaurant:true,category:true},orderBy:[{restaurant:{name:'asc'}},{name:'asc'}]});
      data=items.map(i=>({Restaurant:i.restaurant.name,Item:i.name,Category:i.category?.name||'',Food_Type:i.foodType,Price:Number(i.price),Quantity:Number(i.quantity),Unit:i.unit,Available:i.available,Updated_At:i.updatedAt.toISOString()}));
    } else if(type==='Review report') {
      const reviews=await db.review.findMany({where:{isPublished:true,...(scope?{restaurantId:{in:scope}}:{}),...(restaurantId?{restaurantId}:{}),createdAt:{gte:start,lte:end}},include:{restaurant:true,menuItem:true},orderBy:{createdAt:'desc'}});
      data=reviews.map(r=>({Restaurant:r.restaurant.name,Customer:r.customerName||'Guest',Dish:r.menuItem?.name||'',Rating:r.rating,Comment:r.comment||'',Created_At:r.createdAt.toISOString()}));
    } else {
      const logs=await db.auditLog.findMany({where:{...(scope?{restaurantId:{in:scope}}:{}),...(restaurantId?{restaurantId}:{}),createdAt:{gte:start,lte:end}},include:{actor:true,restaurant:true},orderBy:{createdAt:'desc'}});
      data=logs.map(l=>({Date:l.createdAt.toISOString(),Actor:l.actor?.name||'System',Restaurant:l.restaurant?.name||'',Action:l.action,Type:l.objectType,Object_ID:l.objectId||''}));
    }
    const amounts=type==='Order report'?data.reduce((sum,row)=>sum+Number(row.Amount||0),0):0;
    const ratings=type==='Review report'?data.map(row=>Number(row.Rating||0)):[];
    const average=ratings.length?ratings.reduce((a,b)=>a+b,0)/ratings.length:0;
    const scans=data.reduce((sum,row)=>sum+Number(row.Scans||0),0);
    return NextResponse.json({type,range,from:start.toISOString(),to:end.toISOString(),data,metrics:{rows:data.length,revenue:amounts,averageRating:average,scans}});
  } catch(error) {
    if (error instanceof Error && error.message === 'INVALID_REPORT_DATE_RANGE') return NextResponse.json({error:'Invalid report date range'}, {status:400});
    return jsonError(error);
  }
}
