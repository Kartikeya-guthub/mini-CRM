export interface FilterRule {
  field: string
  operator: string
  value: string | number | string[]
}

export interface FilterDefinition {
  combinator: 'AND' | 'OR'
  rules: FilterRule[]
}

export interface Customer {
  id: string
  name: string
  email: string
  city: string
  total_spent: number
  last_order_at: string | null
}

export interface Segment {
  id: string
  name: string
  filter_definition: FilterDefinition
  customer_count: number
  created_at: string
}

export interface Campaign {
  id: string
  name: string
  status: string
  channel: string
  message: string
  sent_count: number
  delivered_count: number
  failed_count: number
  read_count: number
  opened_count: number
  clicked_count: number
  attributed_orders: number
  created_at: string
  segment: { name: string }
}
