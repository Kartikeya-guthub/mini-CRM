import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function check() {
  const c = await prisma.customer.count();
  const o = await prisma.order.count();
  const s = await prisma.segment.findMany();
  console.log("Customers:", c);
  console.log("Orders:", o);
  console.log("Segments:", JSON.stringify(s, null, 2));
}

check().catch(console.error).finally(() => prisma.$disconnect());
