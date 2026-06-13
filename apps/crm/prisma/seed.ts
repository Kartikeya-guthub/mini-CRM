import { PrismaClient } from '@prisma/client'
import { faker } from '@faker-js/faker'

const prisma = new PrismaClient()

const CITIES = ['Delhi', 'Mumbai', 'Bengaluru', 'Hyderabad', 'Chennai', 'Pune', 'Kolkata', 'Ahmedabad']

async function main() {
  console.log('Clearing existing data...')
  await prisma.communicationEvent.deleteMany()
  await prisma.communication.deleteMany()
  await prisma.order.deleteMany()
  await prisma.campaign.deleteMany()
  await prisma.segment.deleteMany()
  await prisma.customer.deleteMany()

  console.log('Seeding customers...')
  const customerData = Array.from({ length: 500 }, () => ({
    id: faker.string.uuid(),
    name: faker.person.fullName(),
    email: faker.internet.email({ provider: 'example.com' }),
    phone: `+91${faker.string.numeric(10)}`,
    city: faker.helpers.arrayElement(CITIES),
    total_spent: 0,
    order_count: 0,
    created_at: faker.date.past({ years: 2 })
  }))

  await prisma.customer.createMany({ data: customerData })

  console.log('Seeding orders...')
  const totals: Record<string, { spent: number; count: number; lastOrder: Date }> = {}

  const orderData = Array.from({ length: 2000 }, () => {
    const customer = faker.helpers.arrayElement(customerData)
    const amount = parseFloat(faker.commerce.price({ min: 200, max: 15000 }))
    const createdAt = faker.date.past({ years: 1 })

    if (!totals[customer.id]) totals[customer.id] = { spent: 0, count: 0, lastOrder: createdAt }
    totals[customer.id].spent += amount
    totals[customer.id].count += 1
    if (createdAt > totals[customer.id].lastOrder) totals[customer.id].lastOrder = createdAt

    return {
      id: faker.string.uuid(),
      customer_id: customer.id,
      amount,
      items: [{ name: faker.commerce.productName(), qty: faker.number.int({ min: 1, max: 4 }), price: amount }],
      status: 'completed',
      created_at: createdAt
    }
  })

  await prisma.order.createMany({ data: orderData })

  console.log('Updating customer aggregates...')
  for (const [customerId, data] of Object.entries(totals)) {
    await prisma.customer.update({
      where: { id: customerId },
      data: {
        total_spent: parseFloat(data.spent.toFixed(2)),
        order_count: data.count,
        last_order_at: data.lastOrder
      }
    })
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

  console.log('Done.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
