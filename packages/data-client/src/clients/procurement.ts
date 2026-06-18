import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { ok, err, type Result } from '../lib/result'
import { toAppError } from '../lib/errors'
import { receiveBatch, recordStockMovement } from './inventory'

// ── Schemas ───────────────────────────────────────────────────────────────────

export const POStatusSchema = z.enum(['draft', 'ordered', 'partial', 'received', 'cancelled'])
export type POStatus = z.infer<typeof POStatusSchema>

export const PurchaseOrderItemSchema = z.object({
  id: z.string().uuid(),
  purchase_order_id: z.string().uuid(),
  medication_id: z.string().uuid(),
  medication_name: z.string().optional(),
  quantity_ordered: z.number().int().positive(),
  quantity_received: z.number().int().min(0),
  unit_cost: z.number().min(0),
  currency_code: z.string().length(3),
  batch_number: z.string().nullable(),
  expiry_date: z.string().nullable(),
  notes: z.string().nullable(),
  created_at: z.string(),
})

export const PurchaseOrderSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  branch_id: z.string().uuid(),
  supplier_id: z.string().uuid().nullable(),
  supplier_name: z.string().optional().nullable(),
  po_number: z.string(),
  status: POStatusSchema,
  notes: z.string().nullable(),
  expected_date: z.string().nullable(),
  ordered_at: z.string().nullable(),
  received_at: z.string().nullable(),
  created_by: z.string().uuid().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})

export type PurchaseOrder = z.infer<typeof PurchaseOrderSchema>
export type PurchaseOrderItem = z.infer<typeof PurchaseOrderItemSchema>

export interface CreatePOInput {
  organizationId: string
  branchId: string
  supplierId?: string | null
  notes?: string
  expectedDate?: string | null
  createdBy: string
  items: Array<{
    medicationId: string
    quantityOrdered: number
    unitCost: number
    currencyCode: string
    batchNumber?: string | null
    expiryDate?: string | null
    notes?: string | null
  }>
}

export interface ReceivePOInput {
  organizationId: string
  branchId: string
  performedBy: string
  items: Array<{
    poItemId: string
    medicationId: string
    quantityReceived: number
    unitCost: number
    currencyCode: string
    batchNumber?: string | null
    expiryDate?: string | null
  }>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function generatePONumber(): string {
  const now = new Date()
  const yy = String(now.getFullYear()).slice(2)
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const rand = Math.floor(Math.random() * 9000) + 1000
  return `PO-${yy}${mm}-${rand}`
}

// ── Functions ─────────────────────────────────────────────────────────────────

export async function getPurchaseOrders(
  client: SupabaseClient,
  branchId: string,
  opts: { status?: POStatus; limit?: number } = {}
): Promise<Result<PurchaseOrder[]>> {
  try {
    let query = client
      .from('purchase_orders')
      .select(`
        *,
        suppliers ( name )
      `)
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false })
      .limit(opts.limit ?? 50)

    if (opts.status) query = query.eq('status', opts.status)

    const { data, error } = await query
    if (error) return err(toAppError(error))

    const rows = (data ?? []).map((r: Record<string, unknown>) => ({
      ...r,
      supplier_name: (r.suppliers as { name: string } | null)?.name ?? null,
    }))

    const parsed = z.array(PurchaseOrderSchema).safeParse(rows)
    if (!parsed.success) return err(toAppError(parsed.error))
    return ok(parsed.data)
  } catch (e) {
    return err(toAppError(e))
  }
}

export async function getPurchaseOrderItems(
  client: SupabaseClient,
  purchaseOrderId: string
): Promise<Result<PurchaseOrderItem[]>> {
  try {
    const { data, error } = await client
      .from('purchase_order_items')
      .select(`
        *,
        medications_master ( name )
      `)
      .eq('purchase_order_id', purchaseOrderId)
      .order('created_at', { ascending: true })

    if (error) return err(toAppError(error))

    const rows = (data ?? []).map((r: Record<string, unknown>) => ({
      ...r,
      medication_name: (r.medications_master as { name: string } | null)?.name ?? '',
    }))

    const parsed = z.array(PurchaseOrderItemSchema).safeParse(rows)
    if (!parsed.success) return err(toAppError(parsed.error))
    return ok(parsed.data)
  } catch (e) {
    return err(toAppError(e))
  }
}

export async function createPurchaseOrder(
  client: SupabaseClient,
  input: CreatePOInput
): Promise<Result<PurchaseOrder>> {
  try {
    const poNumber = generatePONumber()

    const { data: po, error: poError } = await client
      .from('purchase_orders')
      .insert({
        organization_id: input.organizationId,
        branch_id: input.branchId,
        supplier_id: input.supplierId ?? null,
        po_number: poNumber,
        status: 'ordered',
        notes: input.notes ?? null,
        expected_date: input.expectedDate ?? null,
        ordered_at: new Date().toISOString(),
        created_by: input.createdBy,
      })
      .select()
      .single()

    if (poError) return err(toAppError(poError))

    const items = input.items.map(item => ({
      purchase_order_id: po.id,
      medication_id: item.medicationId,
      quantity_ordered: item.quantityOrdered,
      quantity_received: 0,
      unit_cost: item.unitCost,
      currency_code: item.currencyCode,
      batch_number: item.batchNumber ?? null,
      expiry_date: item.expiryDate ?? null,
      notes: item.notes ?? null,
    }))

    const { error: itemsError } = await client
      .from('purchase_order_items')
      .insert(items)

    if (itemsError) return err(toAppError(itemsError))

    const parsed = PurchaseOrderSchema.safeParse(po)
    if (!parsed.success) return err(toAppError(parsed.error))
    return ok(parsed.data)
  } catch (e) {
    return err(toAppError(e))
  }
}

/**
 * Receive stock against a PO.
 * For each item: calls receiveBatch() then recordStockMovement(receipt).
 * Trigger trg_stock_movement_update_inventory handles current_stock (Rule 3).
 * Updates PO status to 'received' or 'partial'.
 */
export async function receivePurchaseOrder(
  client: SupabaseClient,
  purchaseOrderId: string,
  input: ReceivePOInput
): Promise<Result<{ received: number }>> {
  try {
    let received = 0

    for (const item of input.items) {
      if (item.quantityReceived <= 0) continue

      // Create inventory batch
      const batchResult = await receiveBatch(client, {
        organization_id: input.organizationId,
        branch_id: input.branchId,
        medication_id: item.medicationId,
        batch_number: item.batchNumber?.trim() || `PO-${Date.now()}`,
        expiry_date: item.expiryDate ?? null,
        quantity_received: item.quantityReceived,
        cost_price: item.unitCost,
        currency_code: item.currencyCode,
        created_by: input.performedBy,
      })
      if (!batchResult.ok) return batchResult

      // Record stock movement — trigger fires, updates current_stock
      const movResult = await recordStockMovement(client, {
        organization_id: input.organizationId,
        branch_id: input.branchId,
        medication_id: item.medicationId,
        batch_id: batchResult.data.id,
        movement_type: 'receipt',
        delta: item.quantityReceived,
        reference_id: purchaseOrderId,
        notes: `Received against PO`,
        performed_by: input.performedBy,
      })
      if (!movResult.ok) return movResult

      // Update PO item quantity_received
      await client
        .from('purchase_order_items')
        .update({ quantity_received: item.quantityReceived })
        .eq('id', item.poItemId)

      received++
    }

    // Check if fully received and update PO status
    const { data: allItems } = await client
      .from('purchase_order_items')
      .select('quantity_ordered, quantity_received')
      .eq('purchase_order_id', purchaseOrderId)

    const allReceived = (allItems ?? []).every(
      (i: { quantity_ordered: number; quantity_received: number }) =>
        i.quantity_received >= i.quantity_ordered
    )

    await client
      .from('purchase_orders')
      .update({
        status: allReceived ? 'received' : 'partial',
        received_at: allReceived ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', purchaseOrderId)

    return ok({ received })
  } catch (e) {
    return err(toAppError(e))
  }
}

export async function cancelPurchaseOrder(
  client: SupabaseClient,
  purchaseOrderId: string
): Promise<Result<void>> {
  try {
    const { error } = await client
      .from('purchase_orders')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', purchaseOrderId)
      .in('status', ['draft', 'ordered'])

    if (error) return err(toAppError(error))
    return ok(undefined)
  } catch (e) {
    return err(toAppError(e))
  }
}
