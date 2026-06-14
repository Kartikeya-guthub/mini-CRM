import { PrismaClient } from '@prisma/client'
import { fakerEN_IN as faker } from '@faker-js/faker'
import { countCustomersForFilter } from '../src/lib/segmentEngine'
import { FilterDefinition } from '@xeno/shared'

const prisma = new PrismaClient()

const CITIES = ['Delhi', 'Mumbai', 'Bengaluru', 'Hyderabad', 'Chennai', 'Pune', 'Kolkata', 'Ahmedabad']

async function main() {
  // console.log('Clearing existing data...')
  // await prisma.communicationEvent.deleteMany()
  // await prisma.communication.deleteMany()
  // await prisma.order.deleteMany()
  // await prisma.campaign.deleteMany()
  // await prisma.segment.deleteMany()
  // await prisma.customer.deleteMany()

  console.log('Seeding customers...')
  const customerData = Array.from({ length: 500 }, (_, i) => ({
    id: faker.string.uuid(),
    name: faker.person.fullName(),
    email: `customer_${i}_${faker.string.alphanumeric(4)}@example.com`,
    phone: `+91${faker.string.numeric(10)}`,
    city: faker.helpers.arrayElement(CITIES),
    total_spent: 0,
    order_count: 0,
    created_at: faker.date.past({ years: 2 })
  }))

  for (let i = 0; i < customerData.length; i += 100) {
    await prisma.customer.createMany({ data: customerData.slice(i, i + 100) })
  }

  console.log('Seeding orders...')
  const totals: Record<string, { spent: number; count: number; lastOrder: Date }> = {}

  const orderData = []
  for (let i = 0; i < 2000; i++) {
    const customer = faker.helpers.arrayElement(customerData)
    const amount = parseFloat(faker.commerce.price({ min: 200, max: 15000 }))
    const createdAt = faker.date.between({ from: customer.created_at, to: new Date() })

    if (!totals[customer.id]) totals[customer.id] = { spent: 0, count: 0, lastOrder: createdAt }
    
    if (faker.helpers.arrayElement(['completed', 'completed', 'completed', 'refunded']) === 'completed') {
      totals[customer.id].spent += amount
      totals[customer.id].count += 1
      if (createdAt > totals[customer.id].lastOrder) totals[customer.id].lastOrder = createdAt
    }

    orderData.push({
      id: faker.string.uuid(),
      customer_id: customer.id,
      amount,
      items: [{ name: faker.commerce.productName(), qty: faker.number.int({ min: 1, max: 4 }), price: amount }],
      status: 'completed',
      created_at: createdAt
    })
  }

  for (let i = 0; i < orderData.length; i += 500) {
    await prisma.order.createMany({ data: orderData.slice(i, i + 500) })
  }

  console.log('Updating customer aggregates...')
  const entries = Object.entries(totals)
  for (let i = 0; i < entries.length; i += 50) {
    const chunk = entries.slice(i, i + 50)
    await Promise.all(
      chunk.map(([customerId, data]) =>
        prisma.customer.update({
          where: { id: customerId },
          data: {
            total_spent: parseFloat(data.spent.toFixed(2)),
            order_count: data.count,
            last_order_at: data.lastOrder
          }
        })
      )
    )
  }

  console.log('Seeding segments...')
  await prisma.segment.createMany({
    data: [
      {
        name: 'High Value Customers',
        filter_definition: { combinator: 'AND', rules: [{ field: 'total_spent', operator: 'gte', value: 10000 }] },
        customer_count: 0
      },
      {
        name: 'Dormant Customers',
        filter_definition: { combinator: 'AND', rules: [{ field: 'last_order_at', operator: 'days_ago_gt', value: 60 }] },
        customer_count: 0
      },
      {
        name: 'Mumbai Shoppers',
        filter_definition: { combinator: 'AND', rules: [{ field: 'city', operator: 'eq', value: 'Mumbai' }] },
        customer_count: 0
      }
    ]
  })

  // Update customer_count for all segments after seeding
  const allSegments = await prisma.segment.findMany()
  for (const segment of allSegments) {
    const count = await countCustomersForFilter(segment.filter_definition as FilterDefinition)
    await prisma.segment.update({
      where: { id: segment.id },
      data: { customer_count: count }
    })
  }
  console.log('Segment counts updated.')

  console.log('Done.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
