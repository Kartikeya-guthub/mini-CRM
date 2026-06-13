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

export function buildWhere(filter: FilterDefinition): object {
  const conditions = filter.rules.map(buildCondition)
  return filter.combinator === 'AND' ? { AND: conditions } : { OR: conditions }
}

export async function getCustomersForFilter(filter: FilterDefinition) {
  return prisma.customer.findMany({ where: buildWhere(filter) })
}

export async function countCustomersForFilter(filter: FilterDefinition): Promise<number> {
  return prisma.customer.count({ where: buildWhere(filter) })
}
