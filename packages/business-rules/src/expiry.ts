import type { ExpiryRiskScore } from './types'

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Score the expiry risk for a single inventory batch.
 *
 * Scoring rules (evaluated in priority order):
 *   critical  — expiry within 30 days AND stock won't clear before expiry
 *   low       — expiry > 90 days, OR stock will clear before expiry
 *   high      — expiry within 60 days (31–60 days after critical check)
 *   medium    — expiry within 90 days (61–90 days)
 *
 * `today` is injectable so tests can fix the reference date.
 */
export function scoreExpiryRisk(params: {
  expiry_date: Date
  quantity_remaining: number
  average_daily_usage: number
  today?: Date
}): ExpiryRiskScore {
  const { expiry_date, quantity_remaining, average_daily_usage, today = new Date() } = params

  // Normalise both dates to midnight for consistent whole-day counting
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const expiryMidnight = new Date(
    expiry_date.getFullYear(),
    expiry_date.getMonth(),
    expiry_date.getDate()
  )

  const days_to_expiry = Math.floor(
    (expiryMidnight.getTime() - todayMidnight.getTime()) / MS_PER_DAY
  )

  // Days of stock remaining at current average usage rate.
  // If average_daily_usage is 0 the stock never runs out (Infinity).
  const days_of_stock =
    average_daily_usage > 0 ? quantity_remaining / average_daily_usage : Infinity

  // "Will clear before expiry" means we'll sell the last unit before expiry_date.
  const willClearBeforeExpiry = days_of_stock < days_to_expiry

  let score: ExpiryRiskScore['score']

  if (days_to_expiry <= 30 && !willClearBeforeExpiry) {
    score = 'critical'
  } else if (days_to_expiry > 90 || willClearBeforeExpiry) {
    score = 'low'
  } else if (days_to_expiry <= 60) {
    score = 'high'
  } else {
    score = 'medium'
  }

  return {
    score,
    days_to_expiry,
    days_of_stock: Number.isFinite(days_of_stock) ? Math.ceil(days_of_stock) : 999_999,
  }
}
