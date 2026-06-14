import { Router } from 'express'
import crypto from 'crypto'
import axios from 'axios'
import { prisma } from '../db'
import { getCustomersForFilter } from '../lib/segmentEngine'
import { FilterDefinition, SendPayload } from '@xeno/shared'

import { z } from 'zod'

const router = Router()

const CRM_BASE_URL = process.env.CRM_BASE_URL || 'http://localhost:3000'
const CHANNEL_SERVICE_URL = process.env.CHANNEL_SERVICE_URL || 'http://localhost:4000'

const CampaignCreateSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  segment_id: z.string().uuid('Invalid segment ID'),
  message: z.string().min(1, 'Message is required').max(1000, 'Message too long'),
  channel: z.enum(['whatsapp', 'sms', 'email', 'rcs'])
})

// Create campaign
router.post('/', async (req, res) => {
  const parseResult = CampaignCreateSchema.safeParse(req.body)
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parseResult.error.flatten().fieldErrors })
  }
  
  const { name, segment_id, message, channel } = parseResult.data

  const segment = await prisma.segment.findUnique({ where: { id: segment_id } })
  if (!segment) return res.status(404).json({ error: 'Segment not found' })

  const campaign = await prisma.campaign.create({
    data: { name, segment_id, message, channel, status: 'draft' }
  })

  res.status(201).json(campaign)
})

// Send campaign to segment
router.post('/:id/send', async (req, res) => {
  const { id } = req.params

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: { segment: true }
  })

  if (!campaign) return res.status(404).json({ error: 'Campaign not found' })
  if (campaign.status !== 'draft') return res.status(400).json({ error: 'Campaign already sent' })

  const filter = campaign.segment.filter_definition as unknown as FilterDefinition
  const customers = await getCustomersForFilter(filter)

  if (customers.length === 0) return res.status(400).json({ error: 'No customers match this segment' })

  // Pre-generate IDs so createMany and sends share the same IDs
  const communicationsData = customers.map(customer => ({
    id: crypto.randomUUID(),
    campaign_id: campaign.id,
    customer_id: customer.id,
    channel: campaign.channel,
    message: campaign.message,
    status: 'queued'
  }))

  await prisma.communication.createMany({ data: communicationsData })

  await prisma.campaign.update({
    where: { id },
    data: { status: 'running', sent_count: customers.length }
  })

  // Fire sends — non-blocking with rate limiting
  ;(async () => {
    for (const comm of communicationsData) {
      const customer = customers.find(c => c.id === comm.customer_id)!

      axios.post(`${CHANNEL_SERVICE_URL}/channel/send`, {
        communication_id: comm.id,
        recipient: { customer_id: customer.id, email: customer.email, phone: customer.phone },
        message: comm.message,
        channel: comm.channel as any,
        callback_url: `${CRM_BASE_URL}/api/receipts`
      } as SendPayload).catch(err => {
        console.error(`[CRM] Send failed for ${comm.id}:`, err.message)
      })

      // Add 50ms delay to prevent Supabase connection pool exhaustion (20 req/sec)
      await new Promise(resolve => setTimeout(resolve, 50))
    }
  })()

  res.json({ ok: true, customers_reached: customers.length, campaign_id: campaign.id })
})

// List campaigns
router.get('/', async (_req, res) => {
  const campaigns = await prisma.campaign.findMany({
    orderBy: { created_at: 'desc' },
    include: { segment: { select: { name: true } } }
  })
  res.json(campaigns)
})

// Campaign detail with stats
router.get('/:id', async (req, res) => {
  const { id } = req.params

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: { segment: { select: { name: true, filter_definition: true } } }
  })

  if (!campaign) return res.status(404).json({ error: 'Campaign not found' })

  // Delivery rate, open rate, click rate
  const deliveryRate = campaign.sent_count > 0
    ? ((campaign.delivered_count / campaign.sent_count) * 100).toFixed(1)
    : '0'

  const readRate = campaign.delivered_count > 0
    ? ((campaign.read_count / campaign.delivered_count) * 100).toFixed(1)
    : '0'

  const openRate = campaign.delivered_count > 0
    ? ((campaign.opened_count / campaign.delivered_count) * 100).toFixed(1)
    : '0'

  const clickRate = campaign.opened_count > 0
    ? ((campaign.clicked_count / campaign.opened_count) * 100).toFixed(1)
    : '0'

  res.json({
    ...campaign,
    rates: {
      delivery: `${deliveryRate}%`,
      read: `${readRate}%`,
      open: `${openRate}%`,
      click: `${clickRate}%`
    }
  })
})

// Per-communication breakdown
router.get('/:id/communications', async (req, res) => {
  const { id } = req.params
  const page = parseInt(req.query.page as string) || 1
  const limit = parseInt(req.query.limit as string) || 50
  const skip = (page - 1) * limit

  const [communications, total] = await Promise.all([
    prisma.communication.findMany({
      where: { campaign_id: id },
      skip,
      take: limit,
      orderBy: { created_at: 'desc' },
      include: {
        customer: { select: { name: true, email: true, city: true } },
        events: { select: { event_type: true, created_at: true }, orderBy: { created_at: 'asc' } }
      }
    }),
    prisma.communication.count({ where: { campaign_id: id } })
  ])

  res.json({
    data: communications,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) }
  })
})

export default router
