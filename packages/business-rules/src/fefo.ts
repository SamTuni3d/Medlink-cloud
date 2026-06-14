import type { Batch, BatchSelection } from './types'
import { InsufficientStockError } from './types'

/**
 * Select batches to fulfil `quantityNeeded` using FEFO (First-Expiry, First-Out).
 *
 * Sort order:
 *   1. Batches with an expiry_date, soonest first.
 *   2. Non-expiring batches (expiry_date = null) last, ordered FIFO by received_at.
 *
 * Throws InsufficientStockError if total available across all batches < quantityNeeded.
 * Returns an empty array if quantityNeeded is 0.
 */
export function selectBatches(
  batches: Batch[],
  quantityNeeded: number
): BatchSelection[] {
  if (quantityNeeded === 0) return []

  const available = batches.filter(b => b.quantity_remaining > 0)

  const sorted = [...available].sort((a, b) => {
    // Null expiry (non-expiring) always goes after dated batches
    if (a.expiry_date === null && b.expiry_date !== null) return 1
    if (a.expiry_date !== null && b.expiry_date === null) return -1
    // Both null → FIFO by received_at
    if (a.expiry_date === null && b.expiry_date === null) {
      return a.received_at.getTime() - b.received_at.getTime()
    }
    // Both have dates → FEFO (soonest first)
    return (a.expiry_date as Date).getTime() - (b.expiry_date as Date).getTime()
  })

  const totalAvailable = sorted.reduce((sum, b) => sum + b.quantity_remaining, 0)
  if (totalAvailable < quantityNeeded) {
    throw new InsufficientStockError(quantityNeeded, totalAvailable)
  }

  const selections: BatchSelection[] = []
  let remaining = quantityNeeded

  for (const batch of sorted) {
    if (remaining <= 0) break
    const take = Math.min(batch.quantity_remaining, remaining)
    selections.push({ batch_id: batch.id, quantity: take })
    remaining -= take
  }

  return selections
}
