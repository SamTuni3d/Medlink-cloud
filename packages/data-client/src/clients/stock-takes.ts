import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { ok, err, type Result } from '../lib/result'
import { toAppError } from '../lib/errors'
import { recordStockMovement } from './inventory'

// ── Schema ────────────────────────────────────────────────────────────────────

export const StockTakeSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  branch_id: z.string().uuid(),
  performed_by: z.string().uuid().nullable(),
  notes: z.string().nullable(),
  item_count: z.number().int(),
  discrepancy_count: z.number().int(),
  completed_at: z.string(),
  created_at: z.string(),
})

export type StockTake = z.infer<typeof StockTakeSchema>

// ── Public types ──────────────────────────────────────────────────────────────

export interface StockTakeLineItem {
  medicationId: string
  medicationName: string
  systemCount: number
  physicalCount: number
}

export interface SubmitStockTakeInput {
  organizationId: string
  branchId: string
  performedBy: string
  notes?: string
  items: StockTakeLineItem[]
}

export interface StockTakeResult {
  stockTakeId: string
  itemCount: number
  discrepancyCount: number
  netDelta: number
}

// ── Functions ─────────────────────────────────────────────────────────────────

/**
 * Submits a completed physical stock count.
 *
 * For every item where physicalCount ≠ systemCount:
 *   - Inserts a stock_movements row (movement_type='adjustment', delta=physical-system)
 *   - Trigger trg_stock_movement_update_inventory fires → updates current_stock (Rule 3)
 *
 * Then writes a stock_takes header row for the audit trail and updates
 * inventory.last_reconciled_at for the branch.
 */
export async function submitStockTake(
  client: SupabaseClient,
  input: SubmitStockTakeInput
): Promise<Result<StockTakeResult>> {
  try {
    const { organizationId, branchId, performedBy, notes, items } = input

    const discrepancies = items.filter(i => i.physicalCount !== i.systemCount)
    const label = `Stock take ${new Date().toLocaleDateString('en-GH', {
      day: '2-digit', month: 'short', year: 'numeric',
    })}`

    // 1. Insert one adjustment movement per discrepant item (Rule 3 compliant)
    for (const item of discrepancies) {
      const delta = item.physicalCount - item.systemCount
      const result = await recordStockMovement(client, {
        organization_id: organizationId,
        branch_id: branchId,
        medication_id: item.medicationId,
        movement_type: 'adjustment',
        delta,
        notes: `${label}${notes ? ` — ${notes}` : ''}`,
        performed_by: performedBy,
      })
      if (!result.ok) return result
    }

    // 2. Write the stock_takes audit header
    const { data, error } = await client
      .from('stock_takes')
      .insert({
        organization_id: organizationId,
        branch_id: branchId,
        performed_by: performedBy,
        notes: notes ?? null,
        item_count: items.length,
        discrepancy_count: discrepancies.length,
      })
      .select('id')
      .single()

    if (error) return err(toAppError(error))

    const parsed = StockTakeSchema.pick({ id: true }).safeParse(data)
    if (!parsed.success) return err(toAppError(parsed.error))

    // 3. Stamp last_reconciled_at on every counted inventory row
    const medicationIds = items.map(i => i.medicationId)
    await client
      .from('inventory')
      .update({ last_reconciled_at: new Date().toISOString() })
      .eq('branch_id', branchId)
      .in('medication_id', medicationIds)
    // Non-fatal if this fails — movements already committed

    const netDelta = discrepancies.reduce((sum, i) => sum + (i.physicalCount - i.systemCount), 0)

    return ok({
      stockTakeId: parsed.data.id,
      itemCount: items.length,
      discrepancyCount: discrepancies.length,
      netDelta,
    })
  } catch (e) {
    return err(toAppError(e))
  }
}

/** Fetch recent stock take history for a branch */
export async function getStockTakes(
  client: SupabaseClient,
  branchId: string,
  limit = 20
): Promise<Result<StockTake[]>> {
  try {
    const { data, error } = await client
      .from('stock_takes')
      .select('*')
      .eq('branch_id', branchId)
      .order('completed_at', { ascending: false })
      .limit(limit)

    if (error) return err(toAppError(error))

    const parsed = z.array(StockTakeSchema).safeParse(data)
    if (!parsed.success) return err(toAppError(parsed.error))

    return ok(parsed.data)
  } catch (e) {
    return err(toAppError(e))
  }
}
