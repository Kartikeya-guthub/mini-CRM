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
      detail: err.message,
      nvidia_response: err.response?.data
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
        headers: { Authorization: `Bearer ${(process.env.NVIDIA_API_KEY || '').trim()}`, 'Content-Type': 'application/json' },
        timeout: 15000
      }
    )

    const content = response.data?.choices?.[0]?.message?.content
    const message = content ? content.trim() : `Special offer for ${segment_name}! Shop now.`
    res.json({ message })
  } catch (err: any) {
    console.error('[AI] Message generation failed:', err.message)
    res.status(422).json({ 
      error: 'Failed to generate message',
      detail: err.message,
      nvidia_response: err.response?.data 
    })
  }
})

router.post('/insights', async (req, res) => {
  const { campaign_name, sent, delivered, opened, clicked, attributed_orders, segment_name } = req.body

  const prompt = `You are an expert marketing analyst. Review these campaign results:
Campaign: ${campaign_name || 'Unknown'}
Target Audience: ${segment_name || 'Unknown'}
Sent: ${sent || 0}
Delivered: ${delivered || 0}
Opened: ${opened || 0}
Clicked: ${clicked || 0}
Orders: ${attributed_orders || 0}

Write a natural language summary and recommendation. Then suggest a follow-up audience filter.
Output ONLY raw JSON. No markdown, no explanation.

For the suggested_filter, ONLY use these fields:
- total_spent (number)
- order_count (number)
- last_order_at (date)
- city (string)
- created_at (date)
And ONLY these operators: gte, lte, gt, lt, eq, neq, in, days_ago_gt, days_ago_lt

Format exactly like this:
{
  "summary": "1 sentence summarizing the funnel drop-off.",
  "recommendation": "1-2 sentence recommendation for follow-up strategy.",
  "suggested_filter": {
    "combinator": "AND",
    "rules": [
      { "field": "last_order_at", "operator": "days_ago_gt", "value": 7 }
    ]
  }
}`

  try {
    const response = await axios.post(
      `${NVIDIA_BASE_URL}/chat/completions`,
      {
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
        top_p: 0.95,
        max_tokens: 400
      },
      {
        headers: { Authorization: `Bearer ${(process.env.NVIDIA_API_KEY || '').trim()}`, 'Content-Type': 'application/json' },
        timeout: 15000
      }
    )

    const raw = response.data?.choices?.[0]?.message?.content || ''
    const clean = raw.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean || '{}')

    res.json(parsed)
  } catch (err: any) {
    console.error('[AI] Insights failed:', err.message)
    res.status(422).json({ error: 'Failed to generate insights', detail: err.message })
  }
})

export default router

