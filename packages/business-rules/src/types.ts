export type Batch = {
  id: string
  expiry_date: Date | null
  quantity_remaining: number
  received_at: Date
}

export type BatchSelection = {
  batch_id: string
  quantity: number
}

export type ExpiryRiskScore = {
  score: 'critical' | 'high' | 'medium' | 'low'
  days_to_expiry: number
  days_of_stock: number
}

export class InsufficientStockError extends Error {
  constructor(
    public readonly needed: number,
    public readonly available: number
  ) {
    super(`Insufficient stock: needed ${needed}, available ${available}`)
    this.name = 'InsufficientStockError'
  }
}
