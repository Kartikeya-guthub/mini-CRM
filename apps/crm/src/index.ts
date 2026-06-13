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

dotenv.config()

const app = express()
const server = http.createServer(app)
const PORT = process.env.PORT || 3000

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

app.post('/api/receipts', async (req, res) => {
  const receipt: ReceiptPayload = req.body

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

  try {
    await prisma.communicationEvent.create({
      data: { communication_id: receipt.communication_id, event_type: receipt.event }
    })
  } catch (err: any) {
    if (err.code === 'P2002') {
      console.warn(`[CRM RECEIPT] Duplicate event ${receipt.event}, dropping`)
      return res.json({ ok: true })
    }
    throw err
  }

  await prisma.communication.update({
    where: { id: receipt.communication_id },
    data: { status: incomingEvent }
  })

  const countField: Record<string, string> = {
    delivered: 'delivered_count',
    failed: 'failed_count',
    opened: 'opened_count',
    clicked: 'clicked_count'
  }

  let updatedCampaign = null
  if (countField[incomingEvent]) {
    updatedCampaign = await prisma.campaign.update({
      where: { id: communication.campaign_id },
      data: { [countField[incomingEvent]]: { increment: 1 } }
    })
  }

  // Emit live update to any clients watching this campaign
  if (updatedCampaign) {
    const { sent_count, delivered_count, failed_count } = updatedCampaign

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
        delivered_count: updatedCampaign.delivered_count,
        failed_count: updatedCampaign.failed_count,
        opened_count: updatedCampaign.opened_count,
        clicked_count: updatedCampaign.clicked_count,
        attributed_orders: updatedCampaign.attributed_orders
      })
  }

  console.log(`[CRM RECEIPT] ${receipt.communication_id}: ${currentStatus} → ${incomingEvent}`)
  res.json({ ok: true })
})

// Replace app.listen with server.listen
server.listen(PORT, () => {
  console.log(`CRM running on port ${PORT}`)
})
