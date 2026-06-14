import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { ok, err, type Result } from '../lib/result'
import { toAppError } from '../lib/errors'
import {
  InventoryWithBatchesSchema,
  InventoryBatchSchema,
  InventoryBatchInsertSchema,
  StockMovementSchema,
  StockMovementInsertSchema,
  type InventoryWithBatches,
  type InventoryBatch,
  type InventoryBatchInsert,
  type StockMovement,
  type StockMovementInsert,
} from '../schemas/inventory'

export async function getInventory(
  client: SupabaseClient,
  branchId: string,
  opts: { lowStockOnly?: boolean } = {}
): Promise<Result<InventoryWithBatches[]>> {
  try {
    const { data, error } = await client
      .from('v_inventory_with_batches')
      .select('*')
      .eq('branch_id', branchId)
      .order('medication_name', { ascending: true })

    if (error) return err(toAppError(error))

    const parsed = z.array(InventoryWithBatchesSchema).safeParse(data)
    if (!parsed.success) return err(toAppError(parsed.error))

    if (opts.lowStockOnly) {
      return ok(parsed.data.filter(r => r.available_stock <= r.reorder_point))
    }

    return ok(parsed.data)
  } catch (e) {
    return err(toAppError(e))
  }
}

/** Pull inventory rows updated since cursor — used by the offline sync protocol */
export async function pullInventory(
  client: SupabaseClient,
  branchId: string,
  cursor: number,
  limit = 200
): Promise<Result<{ rows: InventoryWithBatches[]; nextCursor: number }>> {
  try {
    const { data, error } = await client
      .from('v_inventory_with_batches')
      .select('*')
      .eq('branch_id', branchId)
      // The view joins inventory which has updated_seq — we can't filter by it here.
      // Instead, join against the inventory table directly for cursor-based pull.
      // This simplified version fetches all and is refined in the sync Edge Function.
      .order('updated_at', { ascending: true })
      .limit(limit)

    if (error) return err(toAppError(error))

    const parsed = z.array(InventoryWithBatchesSchema).safeParse(data)
    if (!parsed.success) return err(toAppError(parsed.error))

    const nextCursor =
      parsed.data.length > 0 ? cursor + parsed.data.length : cursor

    return ok({ rows: parsed.data, nextCursor })
  } catch (e) {
    return err(toAppError(e))
  }
}

export async function getBatches(
  client: SupabaseClient,
  branchId: string,
  medicationId: string,
  opts: { activeOnly?: boolean } = {}
): Promise<Result<InventoryBatch[]>> {
  try {
    let query = client
      .from('inventory_batches')
      .select('*')
      .eq('branch_id', branchId)
      .eq('medication_id', medicationId)
      // FEFO ordering
      .order('expiry_date', { ascending: true, nullsFirst: false })
      .order('received_at', { ascending: true })

    if (opts.activeOnly !== false) {
      query = query.gt('quantity_remaining', 0)
    }

    const { data, error } = await query
    if (error) return err(toAppError(error))

    const parsed = z.array(InventoryBatchSchema).safeParse(data)
    if (!parsed.success) return err(toAppError(parsed.error))

    return ok(parsed.data)
  } catch (e) {
    return err(toAppError(e))
  }
}

export async function receiveBatch(
  client: SupabaseClient,
  input: InventoryBatchInsert
): Promise<Result<InventoryBatch>> {
  try {
    const validated = InventoryBatchInsertSchema.safeParse(input)
    if (!validated.success) return err(toAppError(validated.error))

    const { data, error } = await client
      .from('inventory_batches')
      .insert({
        ...validated.data,
        quantity_remaining: validated.data.quantity_received,
      })
      .select()
      .single()

    if (error) return err(toAppError(error))

    const parsed = InventoryBatchSchema.safeParse(data)
    if (!parsed.success) return err(toAppError(parsed.error))

    return ok(parsed.data)
  } catch (e) {
    return err(toAppError(e))
  }
}

/**
 * Insert a stock movement row.
 * The DB trigger trg_stock_movement_update_inventory fires automatically
 * and updates inventory.current_stock — never update that column directly.
 */
export async function recordStockMovement(
  client: SupabaseClient,
  input: StockMovementInsert
): Promise<Result<StockMovement>> {
  try {
    const validated = StockMovementInsertSchema.safeParse(input)
    if (!validated.success) return err(toAppError(validated.error))

    const { data, error } = await client
      .from('stock_movements')
      .insert(validated.data)
      .select()
      .single()

    if (error) return err(toAppError(error))

    const parsed = StockMovementSchema.safeParse(data)
    if (!parsed.success) return err(toAppError(parsed.error))

    return ok(parsed.data)
  } catch (e) {
    return err(toAppError(e))
  }
}

export async function recordStockAdjustment(
  client: SupabaseClient,
  opts: {
    organizationId: string
    branchId: string
    medicationId: string
    batchId?: string
    delta: number
    notes: string
    performedBy: string
  }
): Promise<Result<StockMovement>> {
  return recordStockMovement(client, {
    organization_id: opts.organizationId,
    branch_id: opts.branchId,
    medication_id: opts.medicationId,
    batch_id: opts.batchId ?? null,
    movement_type: 'adjustment',
    delta: opts.delta,
    notes: opts.notes,
    performed_by: opts.performedBy,
  })
}

export async function getStockMovements(
  client: SupabaseClient,
  branchId: string,
  medicationId: string,
  limit = 50
): Promise<Result<StockMovement[]>> {
  try {
    const { data, error } = await client
      .from('stock_movements')
      .select('*')
      .eq('branch_id', branchId)
      .eq('medication_id', medicationId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) return err(toAppError(error))

    const parsed = z.array(StockMovementSchema).safeParse(data)
    if (!parsed.success) return err(toAppError(parsed.error))

    return ok(parsed.data)
  } catch (e) {
    return err(toAppError(e))
  }
}
