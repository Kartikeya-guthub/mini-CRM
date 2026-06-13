import { Router } from 'express'
import { prisma } from '../db'
import { countCustomersForFilter, buildWhere } from '../lib/segmentEngine'
import { FilterDefinition } from '@xeno/shared'

const router = Router()

router.get('/', async (_req, res) => {
  const segments = await prisma.segment.findMany({ orderBy: { created_at: 'desc' } })
  res.json(segments)
})

router.post('/preview', async (req, res) => {
  const filter: FilterDefinition = req.body.filter

  if (!filter || !filter.rules || filter.rules.length === 0) {
    return res.status(400).json({ error: 'Filter is required' })
  }

  const [count, sample] = await Promise.all([
    countCustomersForFilter(filter),
    prisma.customer.findMany({
      where: buildWhere(filter),
      take: 5,
      select: { id: true, name: true, email: true, city: true, total_spent: true, last_order_at: true }
    })
  ])

  res.json({ count, sample })
})

router.post('/', async (req, res) => {
  const { name, filter_definition } = req.body
  const count = await countCustomersForFilter(filter_definition)
  const segment = await prisma.segment.create({
    data: { name, filter_definition, customer_count: count }
  })
  res.status(201).json(segment)
})

export default router
