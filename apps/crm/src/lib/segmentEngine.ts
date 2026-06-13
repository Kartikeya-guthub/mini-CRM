import { FilterDefinition, FilterRule } from '@xeno/shared'
import { prisma } from '../db'

function buildCondition(rule: FilterRule): object {
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
}

export async function getCustomersForFilter(filter: FilterDefinition) {
  const conditions = filter.rules.map(buildCondition)
  return prisma.customer.findMany({
    where: filter.combinator === 'AND' ? { AND: conditions } : { OR: conditions }
  })
}

export async function countCustomersForFilter(filter: FilterDefinition): Promise<number> {
  const conditions = filter.rules.map(buildCondition)
  return prisma.customer.count({
    where: filter.combinator === 'AND' ? { AND: conditions } : { OR: conditions }
  })
}
