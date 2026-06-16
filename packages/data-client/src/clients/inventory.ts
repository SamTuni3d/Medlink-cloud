import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { ok, err, type Result } from '../lib/result'
import { toAppError } from '../lib/errors'
import { createMedication } from './medications'
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

export interface AddMedicationWithStockInput {
  organizationId: string
  branchId: string
  performedBy: string
  // Medication master fields
  name: string
  genericName?: string | null
  brandName?: string | null
  category?: string | null
  strength?: string | null
  dosageForm?: string | null
  barcode?: string | null
  reorderPoint?: number
  sellingPrice?: number
  currencyCode?: string
  // Batch / stock fields
  batchNumber?: string | null
  expiryDate?: string | null
  purchasePrice?: number
  qtyInStock?: number
}

/**
 * Creates a new medication, an inventory row for the branch, an optional
 * inventory batch, and — if qty > 0 — an opening-stock movement.
 *
 * Rule 3: inventory.current_stock is NEVER set directly; the Postgres trigger
 * trg_stock_movement_update_inventory handles it via the stock_movements insert.
 */
export async function addMedicationWithStock(
  client: SupabaseClient,
  input: AddMedicationWithStockInput
): Promise<Result<{ medicationId: string }>> {
  try {
    const {
      organizationId, branchId, performedBy,
      name, genericName, brandName, category, strength,
      dosageForm, barcode,
      reorderPoint = 10, sellingPrice = 0,
      currencyCode = 'GHS',
      batchNumber, expiryDate, purchasePrice = 0,
      qtyInStock = 0,
    } = input

    // 1. Create medication in medications_master
    const medResult = await createMedication(client, {
      organization_id: organizationId,
      name: name.trim(),
      generic_name: genericName ?? null,
      brand_name: brandName ?? null,
      dosage_form: dosageForm?.trim() || 'Other',
      strength: strength ?? null,
      unit_of_measure: 'units',
      barcode: barcode ?? null,
      category: category ?? null,
      requires_prescription: false,
      reorder_point: reorderPoint,
      reorder_quantity: Math.max(reorderPoint, 1),
      selling_price: sellingPrice,
      currency_code: currencyCode as 'GHS',
    })
    if (!medResult.ok) return medResult

    const medicationId = medResult.data.id

    // 2. Create inventory row for this branch (current_stock starts at 0)
    const { error: invError } = await client
      .from('inventory')
      .insert({ organization_id: organizationId, branch_id: branchId, medication_id: medicationId })

    if (invError) return err(toAppError(invError))

    // 3. If we have a batch or stock, create the batch record
    if (qtyInStock > 0 || batchNumber || expiryDate) {
      const qty = Math.max(qtyInStock, 1)
      const batchResult = await receiveBatch(client, {
        organization_id: organizationId,
        branch_id: branchId,
        medication_id: medicationId,
        batch_number: batchNumber?.trim() || `OPEN-${Date.now()}`,
        expiry_date: expiryDate ?? null,
        quantity_received: qty,
        cost_price: purchasePrice,
        currency_code: currencyCode,
        created_by: performedBy,
      })
      if (!batchResult.ok) return batchResult

      // 4. Record opening stock movement — trigger updates current_stock
      if (qtyInStock > 0) {
        const movResult = await recordStockMovement(client, {
          organization_id: organizationId,
          branch_id: branchId,
          medication_id: medicationId,
          batch_id: batchResult.data.id,
          movement_type: 'opening_stock',
          delta: qtyInStock,
          notes: 'Initial stock entry',
          performed_by: performedBy,
        })
        if (!movResult.ok) return movResult
      }
    }

    return ok({ medicationId })
  } catch (e) {
    return err(toAppError(e))
  }
}
