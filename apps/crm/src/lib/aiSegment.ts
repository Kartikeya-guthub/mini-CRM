import axios from 'axios'
import { FilterDefinition } from '@xeno/shared'

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1'
const MODEL = 'llama-3.3-70b-versatile'

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
  let response;
  let lastError;
  
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      response = await axios.post(
        `${GROQ_BASE_URL}/chat/completions`,
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
            Authorization: `Bearer ${(process.env.GROQ_API_KEY || '').trim()}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000 // Increased from 15s to 30s
        }
      );
      // If successful, break out of retry loop
      break;
    } catch (err: any) {
      console.warn(`[AI Segment] Attempt ${attempt} failed: ${err.message}`);
      lastError = err;
      if (attempt < 3) await new Promise(r => setTimeout(r, 1000));
    }
  }

  if (!response) {
    if (lastError?.response) {
      throw new Error(`Groq API Error: ${lastError.response.status} - ${JSON.stringify(lastError.response.data)}`);
    }
    throw lastError || new Error('Failed to reach Groq API');
  }

  const raw: string = response.data.choices[0].message.content.trim()
  const clean = raw.replace(/```json|```/g, '').trim()

  const parsed = JSON.parse(clean) as FilterDefinition

  if (!parsed.combinator || !Array.isArray(parsed.rules) || parsed.rules.length === 0) {
    throw new Error('AI returned invalid filter structure')
  }

  console.log(`[AI] "${prompt}" → ${JSON.stringify(parsed)}`)
  return parsed
}
