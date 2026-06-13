import { Router } from 'express'
import { prisma } from '../db'
import { getCustomersForFilter, countCustomersForFilter } from '../lib/segmentEngine'
import { FilterDefinition } from '@xeno/shared'

const router = Router()

// List segments
router.get('/', async (_req, res) => {
  const segments = await prisma.segment.findMany({
    orderBy: { created_at: 'desc' }
  })
  res.json(segments)
})

// Preview segment — returns count + sample customers
router.post('/preview', async (req, res) => {
  const filter: FilterDefinition = req.body.filter

  if (!filter || !filter.rules || filter.rules.length === 0) {
    return res.status(400).json({ error: 'Filter is required' })
  }

  const [count, sample] = await Promise.all([
    countCustomersForFilter(filter),
    prisma.customer.findMany({
      where: buildWhereClause(filter),
      take: 5,
      select: { id: true, name: true, email: true, city: true, total_spent: true, last_order_at: true }
    })
  ])

  res.json({ count, sample })
})

// Create segment
router.post('/', async (req, res) => {
  const { name, filter_definition } = req.body

  const count = await countCustomersForFilter(filter_definition)

  const segment = await prisma.segment.create({
    data: { name, filter_definition, customer_count: count }
  })

  res.status(201).json(segment)
})

// Helper — duplicated from segmentEngine to avoid circular import
function buildWhereClause(filter: FilterDefinition) {
  const conditions = filter.rules.map((rule: any) => {
    const { field, operator, value } = rule
    switch (operator) {
      case 'gt':  return { [field]: { gt: value } }
      case 'lt':  return { [field]: { lt: value } }
      case 'gte': return { [field]: { gte: value } }
      case 'lte': return { [field]: { lte: value } }
      case 'eq':  return { [field]: { equals: value } }
      case 'neq': return { [field]: { not: value } }
      case 'in':  return { [field]: { in: value } }
      case 'days_ago_gt': {
        const date = new Date()
        date.setDate(date.getDate() - Number(value))
        return { [field]: { lt: date } }
      }
      case 'days_ago_lt': {
        const date = new Date()
        date.setDate(date.getDate() - Number(value))
        return { [field]: { gt: date } }
      }
      default: return {}
    }
  })
  return filter.combinator === 'AND' ? { AND: conditions } : { OR: conditions }
}

export default router
