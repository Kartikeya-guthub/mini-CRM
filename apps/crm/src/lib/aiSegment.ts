import axios from 'axios'
import { FilterDefinition } from '@xeno/shared'

const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1'
const MODEL = 'qwen/qwen3.5-122b-a10b'

const SYSTEM_PROMPT = `You are a CRM segmentation assistant for an Indian D2C brand. Convert natural language into a structured filter JSON.

Available fields:
- total_spent (number, rupees): customer's total purchase value
- order_count (number): how many orders placed
- last_order_at (date): when customer last ordered
- city (string): one of Delhi, Mumbai, Bengaluru, Hyderabad, Chennai, Pune, Kolkata, Ahmedabad
- created_at (date): when customer joined

Available operators:
- gte, lte, gt, lt: numeric/date comparisons
- eq, neq: equality
- in: value is a string array (use for city with multiple values)
- days_ago_gt: last_order_at more than N days ago (value = number)
- days_ago_lt: last_order_at less than N days ago (value = number)

Output ONLY raw JSON. No markdown. No backticks. No explanation. Just the JSON object.

Format:
{"combinator":"AND","rules":[{"field":"string","operator":"string","value":number|string|string[]}]}

Examples:
"customers who spent over 5000" → {"combinator":"AND","rules":[{"field":"total_spent","operator":"gte","value":5000}]}
"mumbai and delhi shoppers" → {"combinator":"AND","rules":[{"field":"city","operator":"in","value":["Mumbai","Delhi"]}]}
"dormant customers not ordering in 45 days" → {"combinator":"AND","rules":[{"field":"last_order_at","operator":"days_ago_gt","value":45}]}
"loyal high spenders with 5+ orders and 10000+ spend" → {"combinator":"AND","rules":[{"field":"order_count","operator":"gte","value":5},{"field":"total_spent","operator":"gte","value":10000}]}`

export async function nlToFilter(prompt: string): Promise<FilterDefinition> {
  const response = await axios.post(
    `${NVIDIA_BASE_URL}/chat/completions`,
    {
      model: MODEL,
      messages: [
        { role: 'user', content: `${SYSTEM_PROMPT}\n\nConvert this to filter JSON: "${prompt}"` }
      ],
      temperature: 0.60,
      top_p: 0.95,
      max_tokens: 500
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    }
  )

  const raw: string = response.data.choices[0].message.content.trim()
  const clean = raw.replace(/```json|```/g, '').trim()

  const parsed = JSON.parse(clean) as FilterDefinition

  if (!parsed.combinator || !Array.isArray(parsed.rules) || parsed.rules.length === 0) {
    throw new Error('AI returned invalid filter structure')
  }

  console.log(`[AI] "${prompt}" → ${JSON.stringify(parsed)}`)
  return parsed
}
