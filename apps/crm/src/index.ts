import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { ReceiptPayload, VALID_TRANSITIONS, CommunicationStatus } from '@xeno/shared'
import { prisma } from './db'
import campaignRoutes from './routes/campaigns'
import orderRoutes from './routes/orders'
import segmentRoutes from './routes/segments'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ service: 'crm', status: 'ok', timestamp: new Date().toISOString() })
})

app.use('/api/campaigns', campaignRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/segments', segmentRoutes)

// Receipt handler — updated with campaign aggregate counts
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

  // Update communication status
  await prisma.communication.update({
    where: { id: receipt.communication_id },
    data: { status: incomingEvent }
  })

  // Increment campaign aggregate count
  const countField: Record<string, string> = {
    delivered: 'delivered_count',
    failed: 'failed_count',
    opened: 'opened_count',
    clicked: 'clicked_count'
  }

  if (countField[incomingEvent]) {
    await prisma.campaign.update({
      where: { id: communication.campaign_id },
      data: { [countField[incomingEvent]]: { increment: 1 } }
    })
  }

  console.log(`[CRM RECEIPT] ${receipt.communication_id}: ${currentStatus} → ${incomingEvent}`)
  res.json({ ok: true })
})

app.listen(PORT, () => {
  console.log(`CRM running on port ${PORT}`)
})
