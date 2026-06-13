import { Router } from 'express'
import axios from 'axios'
import { nlToFilter } from '../lib/aiSegment'
import { countCustomersForFilter, buildWhere } from '../lib/segmentEngine'
import { prisma } from '../db'

const router = Router()

const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1'
const MODEL = 'qwen/qwen3.5-122b-a10b'

router.post('/segment', async (req, res) => {
  const { prompt } = req.body

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'prompt is required' })
  }

  try {
    const filter = await nlToFilter(prompt)

    const [count, sample] = await Promise.all([
      countCustomersForFilter(filter),
      prisma.customer.findMany({
        where: buildWhere(filter),
        take: 5,
        select: { id: true, name: true, email: true, city: true, total_spent: true, last_order_at: true }
      })
    ])

    console.log(`[AI] "${prompt}" → ${filter.rules.length} rules → ${count} customers`)

    res.json({ filter, count, sample, prompt })
  } catch (err: any) {
    console.error('[AI] Failed:', err.message)
    res.status(422).json({
      error: 'Could not convert prompt to filter',
      detail: err.message
    })
  }
})

router.post('/message', async (req, res) => {
  const { segment_name, channel } = req.body

  if (!segment_name) return res.status(400).json({ error: 'segment_name is required' })

  try {
    const response = await axios.post(
      `${NVIDIA_BASE_URL}/chat/completions`,
      {
        model: MODEL,
        messages: [{
          role: 'user',
          content: `Write a short personalized marketing message for a ${channel || 'email'} campaign targeting "${segment_name}". Keep it under 160 characters. Be conversational with a clear call-to-action. Output ONLY the message text, no quotes, no explanation.`
        }],
        temperature: 0.8,
        top_p: 0.95,
        max_tokens: 100
      },
      {
        headers: { Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`, 'Content-Type': 'application/json' },
        timeout: 15000
      }
    )

    const message = response.data.choices[0].message.content.trim()
    res.json({ message })
  } catch (err: any) {
    console.error('[AI] Message generation failed:', err.message)
    res.status(422).json({ error: 'Failed to generate message' })
  }
})

export default router

