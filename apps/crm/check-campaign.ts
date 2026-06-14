import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function check() {
  const c = await prisma.campaign.findFirst({ orderBy: { created_at: "desc" } });
  if (c) {
    console.log("Campaign Stats:", { sent: c.sent_count, delivered: c.delivered_count, opened: c.opened_count, clicked: c.clicked_count });
    const stats = await prisma.communication.groupBy({ by: ["status"], _count: true, where: { campaign_id: c.id } });
    console.log("Communication breakdown:", stats);
  }
}

check().catch(console.error).finally(() => prisma.$disconnect());
