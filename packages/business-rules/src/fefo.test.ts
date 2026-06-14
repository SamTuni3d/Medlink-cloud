import { describe, it, expect } from 'vitest'
import { selectBatches } from './fefo'
import { InsufficientStockError } from './types'
import type { Batch } from './types'

function batch(
  id: string,
  quantity_remaining: number,
  expiry_date: Date | null,
  received_at = new Date('2024-01-01')
): Batch {
  return { id, expiry_date, quantity_remaining, received_at }
}

describe('selectBatches', () => {
  it('returns empty array when quantityNeeded is 0', () => {
    const b = batch('a', 10, new Date('2025-06-01'))
    expect(selectBatches([b], 0)).toEqual([])
  })

  it('selects a single batch for an exact-match quantity', () => {
    const b = batch('a', 10, new Date('2025-06-01'))
    const result = selectBatches([b], 10)
    expect(result).toEqual([{ batch_id: 'a', quantity: 10 }])
  })

  it('takes only what is needed from a batch with surplus stock', () => {
    const b = batch('a', 50, new Date('2025-06-01'))
    const result = selectBatches([b], 5)
    expect(result).toEqual([{ batch_id: 'a', quantity: 5 }])
  })

  it('picks soonest-expiring batch first (FEFO ordering)', () => {
    const soon = batch('soon', 10, new Date('2025-03-01'))
    const late = batch('late', 10, new Date('2025-12-01'))
    // Pass in reverse order to prove sorting is applied, not insertion order
    const result = selectBatches([late, soon], 5)
    expect(result).toEqual([{ batch_id: 'soon', quantity: 5 }])
  })

  it('splits quantity across multiple batches in FEFO order', () => {
    const b1 = batch('b1', 4, new Date('2025-03-01'))
    const b2 = batch('b2', 10, new Date('2025-06-01'))
    const result = selectBatches([b2, b1], 10)
    expect(result).toEqual([
      { batch_id: 'b1', quantity: 4 },
      { batch_id: 'b2', quantity: 6 },
    ])
  })

  it('places non-expiring batches (null expiry) last', () => {
    const dated = batch('dated', 5, new Date('2025-06-01'))
    const noExpiry = batch('noexp', 10, null)
    const result = selectBatches([noExpiry, dated], 8)
    expect(result).toEqual([
      { batch_id: 'dated', quantity: 5 },
      { batch_id: 'noexp', quantity: 3 },
    ])
  })

  it('orders multiple non-expiring batches FIFO by received_at', () => {
    const older = batch('older', 5, null, new Date('2024-01-01'))
    const newer = batch('newer', 5, null, new Date('2024-06-01'))
    const result = selectBatches([newer, older], 5)
    expect(result).toEqual([{ batch_id: 'older', quantity: 5 }])
  })

  it('throws InsufficientStockError when total stock < quantityNeeded', () => {
    const b = batch('a', 3, new Date('2025-06-01'))
    expect(() => selectBatches([b], 10)).toThrow(InsufficientStockError)
    expect(() => selectBatches([b], 10)).toThrow('needed 10, available 3')
  })

  it('ignores batches with zero quantity_remaining', () => {
    const empty = batch('empty', 0, new Date('2025-01-01'))
    const full = batch('full', 10, new Date('2025-06-01'))
    const result = selectBatches([empty, full], 5)
    expect(result).toEqual([{ batch_id: 'full', quantity: 5 }])
  })
})
