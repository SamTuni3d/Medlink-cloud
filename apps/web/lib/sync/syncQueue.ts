import type { SupabaseClient } from '@supabase/supabase-js'
import { db } from '@/lib/dexie/db'
import { recordSale } from '@medlink/data-client'

/**
 * Push all pending sales from Dexie to the server via fn_record_sale RPC.
 *
 * This runs in the background — it MUST NOT block the POS UI in any way.
 * Call from a useEffect, an `online` event listener, or a periodic interval.
 */
export async function processSyncQueue(client: SupabaseClient): Promise<void> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return

  // Re-queue previously failed sales so they get another attempt
  await db.pending_sales
    .where('sync_status')
    .equals('failed')
    .modify({ sync_status: 'pending', sync_error: null })

  const pending = await db.pending_sales
    .where('sync_status')
    .equals('pending')
    .toArray()

  for (const sale of pending) {
    // Mark as syncing to prevent duplicate pushes if this function is called concurrently
    await db.pending_sales.update(sale.id, { sync_status: 'syncing' })

    const items = await db.pending_sale_items
      .where('sale_id')
      .equals(sale.id)
      .toArray()

    const result = await recordSale(client, {
      sale: {
        organization_id: sale.organization_id,
        branch_id: sale.branch_id,
        device_id: sale.device_id,
        cashier_id: sale.cashier_id,
        sale_number: sale.sale_number,
        status: sale.status,
        subtotal: sale.subtotal,
        discount_amount: sale.discount_amount,
        tax_amount: sale.tax_amount,
        total_amount: sale.total_amount,
        currency_code: sale.currency_code,
        payment_method: sale.payment_method,
        amount_tendered: sale.amount_tendered ?? undefined,
        change_given: sale.change_given ?? undefined,
        prescription_number: sale.prescription_number ?? undefined,
        customer_name: sale.customer_name ?? undefined,
        created_at: sale.created_at,
      },
      items: items.map(item => ({
        medication_id: item.medication_id,
        batch_id: item.batch_id ?? undefined,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_percent: item.discount_percent,
        line_total: item.line_total,
        currency_code: item.currency_code,
      })),
    })

    if (result.ok) {
      await db.pending_sales.update(sale.id, {
        sync_status: 'synced',
        sync_error: null,
      })
    } else {
      await db.pending_sales.update(sale.id, {
        sync_status: 'failed',
        sync_error: result.error.message,
      })
    }
  }
}

/** Seed medications_cache from Supabase for the given org. */
export async function seedMedicationsCache(
  client: SupabaseClient,
  organizationId: string
): Promise<void> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return

  const { getMedications } = await import('@medlink/data-client')
  const result = await getMedications(client, organizationId, { activeOnly: true })
  if (!result.ok) return

  await db.medications_cache.bulkPut(
    result.data.map(m => ({
      id: m.id,
      organization_id: m.organization_id,
      name: m.name,
      generic_name: m.generic_name,
      brand_name: m.brand_name,
      dosage_form: m.dosage_form,
      strength: m.strength,
      unit_of_measure: m.unit_of_measure,
      barcode: m.barcode,
      category: m.category,
      requires_prescription: m.requires_prescription,
      selling_price: m.selling_price,
      currency_code: m.currency_code,
      reorder_point: m.reorder_point,
      is_active: m.is_active,
      updated_seq: m.updated_seq,
    }))
  )
}

/** Seed inventory_cache and inventory_batches_cache from Supabase for the given branch. */
export async function seedInventoryCache(
  client: SupabaseClient,
  branchId: string
): Promise<void> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return

  const { getInventory, getBatches } = await import('@medlink/data-client')

  const inventoryResult = await getInventory(client, branchId)
  if (!inventoryResult.ok) return

  await db.inventory_cache.bulkPut(
    inventoryResult.data.map(row => ({
      inventory_id: row.inventory_id,
      branch_id: row.branch_id,
      medication_id: row.medication_id,
      current_stock: row.current_stock,
      available_stock: row.available_stock,
      reorder_point: row.reorder_point,
    }))
  )

  // Seed batches for every medication that has stock
  const medicationIds = inventoryResult.data
    .filter(r => r.available_stock > 0)
    .map(r => r.medication_id)

  for (const medId of medicationIds) {
    const batchResult = await getBatches(client, branchId, medId, { activeOnly: true })
    if (!batchResult.ok) continue
    await db.inventory_batches_cache.bulkPut(
      batchResult.data.map(b => ({
        id: b.id,
        branch_id: b.branch_id,
        medication_id: b.medication_id,
        batch_number: b.batch_number,
        expiry_date: b.expiry_date,
        quantity_remaining: b.quantity_remaining,
        currency_code: b.currency_code,
        received_at: b.received_at,
        updated_seq: b.updated_seq,
      }))
    )
  }
}
