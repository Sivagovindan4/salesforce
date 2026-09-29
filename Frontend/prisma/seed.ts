import 'dotenv/config';
import { PrismaClient, UserRole } from '@prisma/client';
import { randomBytes, scrypt as scryptCb } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt=promisify(scryptCb); const db=new PrismaClient();
async function main(){
 const permissions=['restaurants.read','restaurants.write','menu.read','menu.write','orders.read','orders.write','reviews.read','users.write','reports.read'].map(key=>({key,description:`Permission to ${key.replace('.',' ')}`}));
 for(const permission of permissions) await db.permission.upsert({where:{key:permission.key},create:permission,update:{description:permission.description}});
 const email=process.env.SEED_ADMIN_EMAIL||'admin@scanzaa.local'; const password=process.env.SEED_ADMIN_PASSWORD||'Scanzaa-Dev-2026!'; const salt=randomBytes(16).toString('hex'); const passwordHash=`${salt}:${(await scrypt(password,salt,64) as Buffer).toString('hex')}`;
 const user=await db.user.upsert({where:{email},create:{name:'Scanzaa Admin',email,passwordHash,role:UserRole.SUPER_ADMIN,status:'ACTIVE'},update:{passwordHash,status:'ACTIVE'}});
 const restaurant=await db.restaurant.upsert({where:{externalId:'DEV-REST-001'},create:{externalId:'DEV-REST-001',name:"Anbu'de Cafe",slug:'anbude-cafe-dev',description:'A neighborhood cafe serving comfort food.',cuisine:['Cafe','Fast Food'],city:'Chennai',country:'India',status:'ACTIVE'},update:{}});
 const category=await db.menuCategory.upsert({where:{restaurantId_name:{restaurantId:restaurant.id,name:'Main Course'}},create:{restaurantId:restaurant.id,name:'Main Course'},update:{}});
 await db.menuItem.upsert({where:{externalId:'DEV-MENU-001'},create:{externalId:'DEV-MENU-001',restaurantId:restaurant.id,categoryId:category.id,name:'Chicken Biryani',description:'Aromatic basmati rice with tender chicken and house spices.',imageUrl:'https://images.unsplash.com/photo-1563379091339-03246963d96c?auto=format&fit=crop&w=900&q=80',foodType:'NON_VEG',price:180,quantity:450,unit:'g',servingSize:'Serves 1',spiceLevel:'Medium',preparationMins:20,ingredients:['Basmati rice','Chicken','Spices'],allergens:[],available:true},update:{}});
 const table=await db.diningTable.upsert({where:{restaurantId_label:{restaurantId:restaurant.id,label:'Table 01'}},create:{restaurantId:restaurant.id,label:'Table 01',qrCode:{create:{}}},update:{}});
 if(!await db.qRCode.findUnique({where:{tableId:table.id}})) await db.qRCode.create({data:{tableId:table.id}});
 console.log(`Seeded ${email} with development credentials; restaurant ${restaurant.id}`); await db.$disconnect();
}
main().catch(async e=>{console.error(e);await db.$disconnect();process.exit(1)});
