import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import axios from 'axios'
import { SendPayload, EventType } from '@xeno/shared'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 4000

app.use(cors())
app.use(express.json())

// Helpers
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const randomBetween = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min

async function simulate(payload: SendPayload): Promise<void> {
  const { communication_id, callback_url } = payload

  const fireCallback = async (event: EventType) => {
    try {
      await axios.post(callback_url, {
        communication_id,
        event,
        timestamp: new Date().toISOString()
      })
      console.log(`[CHANNEL] Fired ${event} for ${communication_id}`)
    } catch (err: any) {
      console.error(`[CHANNEL] Callback failed for ${event}:`, err.message)
    }
  }

  // sent — always fires
  await delay(randomBetween(300, 600))
  await fireCallback('sent')

  // delivered (90%) or failed (10%)
  await delay(randomBetween(1000, 2000))
  const delivered = Math.random() > 0.1

  if (!delivered) {
    await fireCallback('failed')
    return
  }

  await fireCallback('delivered')

  // opened — 40% chance
  await delay(randomBetween(2000, 4000))
  if (Math.random() > 0.4) return
  await fireCallback('opened')

  // clicked — 30% chance
  await delay(randomBetween(2000, 4000))
  if (Math.random() > 0.3) return
  await fireCallback('clicked')
}

app.get('/health', (_req, res) => {
  res.json({ service: 'channel', status: 'ok', timestamp: new Date().toISOString() })
})

app.post('/channel/send', (req, res) => {
  const payload: SendPayload = req.body

  console.log(`[CHANNEL] Accepted ${payload.communication_id} via ${payload.channel}`)

  // Respond immediately — simulation runs async
  res.json({ accepted: true })

  // Fire and forget
  simulate(payload).catch(err =>
    console.error(`[CHANNEL] Simulation error for ${payload.communication_id}:`, err.message)
  )
})

app.listen(PORT, () => {
  console.log(`Channel service running on port ${PORT}`)
})
