export type Channel = 'whatsapp' | 'sms' | 'email' | 'rcs'

export type CommunicationStatus =
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'read'
  | 'opened'
  | 'clicked'

export type EventType = 'sent' | 'delivered' | 'failed' | 'read' | 'opened' | 'clicked'

export const VALID_TRANSITIONS: Record<CommunicationStatus, CommunicationStatus[]> = {
  queued:    ['sent'],
  sent:      ['delivered', 'failed'],
  delivered: ['read', 'opened'],
  failed:    [],
  read:      ['opened'],
  opened:    ['clicked'],
  clicked:   []
}

export interface SendPayload {
  communication_id: string
  recipient: {
    customer_id: string
    email: string
    phone: string
  }
  message: string
  channel: Channel
  callback_url: string
}

export interface ReceiptPayload {
  communication_id: string
  event: EventType
  timestamp: string
}

export type FilterField =
  | 'total_spent'
  | 'last_order_at'
  | 'order_count'
  | 'city'
  | 'created_at'

export type FilterOperator =
  | 'gt' | 'lt' | 'gte' | 'lte'
  | 'eq' | 'neq'
  | 'in'
  | 'days_ago_gt' | 'days_ago_lt'

export interface FilterRule {
  field: FilterField
  operator: FilterOperator
  value: number | string | string[]
}

export interface FilterDefinition {
  combinator: 'AND' | 'OR'
  rules: FilterRule[]
}
