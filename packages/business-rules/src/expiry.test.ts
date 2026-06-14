import { describe, it, expect } from 'vitest'
import { scoreExpiryRisk } from './expiry'

const TODAY = new Date('2025-06-01')

function score(days_to_expiry: number, qty: number, usage: number) {
  const expiry = new Date(TODAY)
  expiry.setDate(expiry.getDate() + days_to_expiry)
  return scoreExpiryRisk({
    expiry_date: expiry,
    quantity_remaining: qty,
    average_daily_usage: usage,
    today: TODAY,
  })
}

describe('scoreExpiryRisk', () => {
  it('scores critical when expiry ≤30 days and stock will not clear', () => {
    // 20 days to expiry, 100 units at 1/day → 100 days of stock, will NOT clear
    const result = score(20, 100, 1)
    expect(result.score).toBe('critical')
    expect(result.days_to_expiry).toBe(20)
    expect(result.days_of_stock).toBe(100)
  })

  it('scores low when expiry >90 days regardless of usage', () => {
    const result = score(120, 10, 0.1)
    expect(result.score).toBe('low')
    expect(result.days_to_expiry).toBe(120)
  })

  it('scores low when stock will clear before expiry (even within 30 days)', () => {
    // 25 days to expiry, 5 units at 5/day → 1 day of stock → clears before expiry
    const result = score(25, 5, 5)
    expect(result.score).toBe('low')
    expect(result.days_to_expiry).toBe(25)
    expect(result.days_of_stock).toBe(1)
  })

  it('scores high when expiry is 31–60 days and stock will not clear', () => {
    // 45 days to expiry, 1000 units at 1/day → 1000 days of stock
    const result = score(45, 1000, 1)
    expect(result.score).toBe('high')
    expect(result.days_to_expiry).toBe(45)
  })

  it('scores medium when expiry is 61–90 days and stock will not clear', () => {
    // 75 days to expiry, 1000 units at 1/day
    const result = score(75, 1000, 1)
    expect(result.score).toBe('medium')
    expect(result.days_to_expiry).toBe(75)
  })

  it('returns days_of_stock as 999_999 when average_daily_usage is 0', () => {
    const result = score(20, 50, 0)
    // Zero usage → never clears → critical (20 days ≤30 and !willClear)
    expect(result.score).toBe('critical')
    expect(result.days_of_stock).toBe(999_999)
  })

  it('normalises time-of-day differences to whole-day counts', () => {
    // Use a today with a non-midnight time to confirm normalisation
    const todayNoon = new Date('2025-06-01T12:00:00')
    const expiryMidnight = new Date('2025-07-01T00:00:00') // exactly 30 days later
    const result = scoreExpiryRisk({
      expiry_date: expiryMidnight,
      quantity_remaining: 1000,
      average_daily_usage: 1,
      today: todayNoon,
    })
    expect(result.days_to_expiry).toBe(30)
    expect(result.score).toBe('critical')
  })
})
