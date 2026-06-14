import { describe, it, expect } from 'vitest'
import { calculateReorderPoint } from './reorder'

describe('calculateReorderPoint', () => {
  it('calculates standard case with default safety stock (7 days)', () => {
    // 10 units/day × (5 lead days + 7 safety days) = 120
    expect(calculateReorderPoint({ average_daily_usage: 10, lead_time_days: 5 })).toBe(120)
  })

  it('returns 0 when average_daily_usage is 0', () => {
    expect(calculateReorderPoint({ average_daily_usage: 0, lead_time_days: 14 })).toBe(0)
  })

  it('rounds up for fractional usage (ceil)', () => {
    // 1.5 units/day × (3 + 7) = 15.0 → no rounding needed, confirm ceil
    expect(calculateReorderPoint({ average_daily_usage: 1.5, lead_time_days: 3 })).toBe(15)

    // 1.3 × (3 + 7) = 13.0
    expect(calculateReorderPoint({ average_daily_usage: 1.3, lead_time_days: 3 })).toBe(13)

    // 0.7 × (2 + 7) = 6.3 → ceiled to 7
    expect(calculateReorderPoint({ average_daily_usage: 0.7, lead_time_days: 2 })).toBe(7)
  })

  it('respects a custom safety_stock_days override', () => {
    // 5 units/day × (10 lead + 14 safety) = 120
    expect(
      calculateReorderPoint({ average_daily_usage: 5, lead_time_days: 10, safety_stock_days: 14 })
    ).toBe(120)

    // 0 safety stock: 5 × 10 = 50
    expect(
      calculateReorderPoint({ average_daily_usage: 5, lead_time_days: 10, safety_stock_days: 0 })
    ).toBe(50)
  })
})
