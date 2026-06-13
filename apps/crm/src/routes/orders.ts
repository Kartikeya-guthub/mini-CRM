import { Router } from 'express'
import { prisma } from '../db'

const router = Router()

router.post('/', async (req, res) => {
  const { customer_id, amount, items } = req.body

  const customer = await prisma.customer.findUnique({ where: { id: customer_id } })
  if (!customer) return res.status(404).json({ error: 'Customer not found' })

  // Attribution check — find latest delivered communication within 48h
  const window = new Date(Date.now() - 48 * 60 * 60 * 1000)

  const deliveredEvent = await prisma.communicationEvent.findFirst({
    where: {
      event_type: 'delivered',
      created_at: { gte: window },
      communication: { customer_id }
    },
    orderBy: { created_at: 'desc' },
    include: { communication: true }
  })

  const attributedCampaignId = deliveredEvent?.communication.campaign_id ?? null

  // Create order
  const order = await prisma.order.create({
    data: {
      customer_id,
      amount,
      items: items ?? [],
      status: 'completed',
      attributed_campaign_id: attributedCampaignId
    }
  })

  // Update customer aggregates
  await prisma.customer.update({
    where: { id: customer_id },
    data: {
      total_spent: { increment: amount },
      order_count: { increment: 1 },
      last_order_at: new Date()
    }
  })

  // Increment campaign attribution count
  if (attributedCampaignId) {
    await prisma.campaign.update({
      where: { id: attributedCampaignId },
      data: { attributed_orders: { increment: 1 } }
    })
    console.log(`[ATTRIBUTION] Order ${order.id} attributed to campaign ${attributedCampaignId}`)
  } else {
    console.log(`[ATTRIBUTION] Order ${order.id} — no campaign within 48h window`)
  }

  res.status(201).json({ order, attributed_campaign_id: attributedCampaignId })
})

router.get('/', async (_req, res) => {
  const orders = await prisma.order.findMany({
    orderBy: { created_at: 'desc' },
    take: 50,
    include: { customer: { select: { name: true, email: true } } }
  })
  res.json(orders)
})

export default router
