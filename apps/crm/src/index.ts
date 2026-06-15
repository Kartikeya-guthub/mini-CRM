import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import http from 'http'
import { ReceiptPayload, VALID_TRANSITIONS, CommunicationStatus } from '@xeno/shared'
import { prisma } from './db'
import { initSocket, getIO } from './socket'
import campaignRoutes from './routes/campaigns'
import segmentRoutes from './routes/segments'
import orderRoutes from './routes/orders'
import aiRoutes from './routes/ai'
import { z } from 'zod'
import Redis from 'ioredis'

dotenv.config()

const rawRedisUrl = process.env.REDIS_URL || 'redis://default:gQAAAAAAAZaaAAIgcDIxYzFkNThlYjA1OWY0ZGFhODE4NzYwMWQzNTU3YjBlZQ@helped-quetzal-104090.upstash.io:6379'
const cleanRedisUrl = rawRedisUrl.replace('redis-cli --tls -u ', '').trim()

const redis = new Redis(cleanRedisUrl, {
  maxRetriesPerRequest: null, // Don't crash on max retries
  enableOfflineQueue: false,  // Don't hang promises forever if disconnected
  retryStrategy(times) {
    return Math.min(times * 50, 2000);
  }
})

redis.on('error', (err) => {
  console.warn('[REDIS] Connection error:', err.message)
})

const ReceiptSchema = z.object({
  communication_id: z.string().uuid(),
  event: z.enum(['sent', 'delivered', 'failed', 'read', 'opened', 'clicked']),
  timestamp: z.string()
})

const app = express()
const server = http.createServer(app)
const PORT = process.env.PORT || 3000

// Auto-migrate to add read_count if it doesn't exist (bypassing Prisma Migrate restrictions with PgBouncer)
prisma.$executeRawUnsafe(`
  ALTER TABLE "campaigns" ADD COLUMN "read_count" INTEGER NOT NULL DEFAULT 0;
`).catch(() => {
  // Ignore error if column already exists
})

initSocket(server)

app.use(cors({
  origin: ['http://localhost:5173', process.env.FRONTEND_URL || '']
}))
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ service: 'crm', status: 'ok', timestamp: new Date().toISOString() })
})

app.use('/api/campaigns', campaignRoutes)
app.use('/api/segments', segmentRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/ai', aiRoutes)

// TEMP DEBUG ROUTE
app.get('/api/debug-env', (req, res) => {
  const key = process.env.NVIDIA_API_KEY
  res.json({
    hasKey: !!key,
    keyLength: key?.length || 0,
    prefix: key ? key.substring(0, 5) : 'none',
    nodeEnv: process.env.NODE_ENV
  })
})

app.post('/api/receipts', async (req, res) => {
  const parseResult = ReceiptSchema.safeParse(req.body)
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parseResult.error.flatten().fieldErrors })
  }
  
  const receipt = parseResult.data

  // REDIS IDEMPOTENCY CHECK
  let isNew: string | null | boolean = true
  try {
    const idempotencyKey = `comm:${receipt.communication_id}:${receipt.event}`
    isNew = await redis.set(idempotencyKey, '1', 'EX', 86400, 'NX')
  } catch (err: any) {
    console.warn(`[CRM RECEIPT] Redis failed, bypassing idempotency check: ${err.message}`)
  }
  
  if (!isNew) {
    console.warn(`[CRM RECEIPT] Redis dup block: ${receipt.event} for ${receipt.communication_id}`)
    return res.json({ ok: true })
  }

  const communication = await prisma.communication.findUnique({
    where: { id: receipt.communication_id }
  })

  if (!communication) {
    console.warn(`[CRM RECEIPT] Unknown communication ${receipt.communication_id}`)
    return res.json({ ok: true })
  }

  const currentStatus = communication.status as CommunicationStatus
  const incomingEvent = receipt.event as CommunicationStatus

  if (!VALID_TRANSITIONS[currentStatus]?.includes(incomingEvent)) {
    console.warn(`[CRM RECEIPT] Invalid transition ${currentStatus} → ${incomingEvent}, dropping`)
    return res.json({ ok: true })
  }

  const countField: Record<string, string> = {
    delivered: 'delivered_count',
    failed: 'failed_count',
    read: 'read_count',
    opened: 'opened_count',
    clicked: 'clicked_count'
  }

  let updatedCampaign = null;

  try {
    const transactionOperations = [
      // 1. Log event
      prisma.communicationEvent.create({
        data: { communication_id: receipt.communication_id, event_type: receipt.event }
      }),
      // 2. Update communication status
      prisma.communication.update({
        where: { id: receipt.communication_id },
        data: { status: incomingEvent }
      })
    ];

    // 3. Update campaign aggregates
    if (countField[incomingEvent]) {
      transactionOperations.push(
        prisma.campaign.update({
          where: { id: communication.campaign_id },
          data: { [countField[incomingEvent]]: { increment: 1 } }
        }) as any
      );
    }

    // Execute all in one database round-trip to prevent connection pool exhaustion and lock contention
    const results = await prisma.$transaction(transactionOperations);
    if (countField[incomingEvent]) {
      updatedCampaign = results[2] as any;
    }
  } catch (err: any) {
    if (err.code === 'P2002') {
      console.warn(`[CRM RECEIPT] Duplicate event ${receipt.event}, dropping`);
      return res.json({ ok: true });
    }
    console.error(`[CRM RECEIPT] Transaction failed:`, err.message);
    return res.status(500).json({ error: 'Database transaction failed' });
  }

  // Emit live update to any clients watching this campaign
  if (updatedCampaign) {
    const { sent_count, delivered_count, failed_count } = updatedCampaign

    // Mark completed when all messages have a terminal state
    if (sent_count > 0 && delivered_count + failed_count >= sent_count) {
      await prisma.campaign.update({
        where: { id: communication.campaign_id },
        data: { status: 'completed' }
      })
    }

    getIO()
      .to(`campaign:${communication.campaign_id}`)
      .emit('stats_update', {
        campaign_id: communication.campaign_id,
        sent_count: updatedCampaign.sent_count,
        delivered_count: updatedCampaign.delivered_count,
        failed_count: updatedCampaign.failed_count,
        read_count: updatedCampaign.read_count,
        opened_count: updatedCampaign.opened_count,
        clicked_count: updatedCampaign.clicked_count,
        attributed_orders: updatedCampaign.attributed_orders
      })
  }

  getIO()
    .to(`campaign:${communication.campaign_id}`)
    .emit('comm_update', {
      id: communication.id,
      status: incomingEvent,
      event_type: incomingEvent,
      created_at: new Date().toISOString()
    })

  console.log(`[CRM RECEIPT] ${receipt.communication_id}: ${currentStatus} → ${incomingEvent}`)
  res.json({ ok: true })
})

// Replace app.listen with server.listen
server.listen(PORT, () => {
  console.log(`CRM running on port ${PORT}`)
})
