/**
 * Calculate the reorder point for a medication.
 *
 * Formula: ceil(average_daily_usage × (lead_time_days + safety_stock_days))
 *
 * The result is the stock level at which a replenishment order should be placed
 * so that stock does not run out before the order arrives (plus a safety buffer).
 */
export function calculateReorderPoint(params: {
  average_daily_usage: number
  lead_time_days: number
  safety_stock_days?: number
}): number {
  const { average_daily_usage, lead_time_days, safety_stock_days = 7 } = params
  return Math.ceil(average_daily_usage * (lead_time_days + safety_stock_days))
}
