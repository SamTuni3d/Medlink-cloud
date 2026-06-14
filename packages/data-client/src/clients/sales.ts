import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { ok, err, type Result } from '../lib/result'
import { toAppError } from '../lib/errors'
import {
  SaleSchema,
  SaleItemSchema,
  RecordSaleInputSchema,
  RecordSaleOutputSchema,
  type Sale,
  type SaleItem,
  type RecordSaleInput,
  type RecordSaleOutput,
} from '../schemas/sales'

/**
 * Record a completed sale atomically via the fn_record_sale RPC.
 *
 * This is the server-side write path — used by the sync queue when pushing
 * offline-created sales from Dexie. The RPC inserts the sale, sale_items,
 * and stock_movements in a single transaction; the inventory trigger fires
 * automatically for each movement row.
 */
export async function recordSale(
  client: SupabaseClient,
  input: RecordSaleInput
): Promise<Result<RecordSaleOutput>> {
  try {
    const validated = RecordSaleInputSchema.safeParse(input)
    if (!validated.success) return err(toAppError(validated.error))

    const { data, error } = await client.rpc('fn_record_sale', {
      p_sale: validated.data.sale,
      p_items: validated.data.items,
    })

    if (error) return err(toAppError(error))

    const parsed = RecordSaleOutputSchema.safeParse(data)
    if (!parsed.success) return err(toAppError(parsed.error))

    return ok(parsed.data)
  } catch (e) {
    return err(toAppError(e))
  }
}

export interface GetSalesOptions {
  cashierId?: string
  status?: 'pending' | 'completed' | 'voided'
  fromDate?: string
  toDate?: string
  limit?: number
  offset?: number
}

export async function getSales(
  client: SupabaseClient,
  branchId: string,
  opts: GetSalesOptions = {}
): Promise<Result<Sale[]>> {
  try {
    let query = client
      .from('sales')
      .select('*')
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false })

    if (opts.cashierId) query = query.eq('cashier_id', opts.cashierId)
    if (opts.status) query = query.eq('status', opts.status)
    if (opts.fromDate) query = query.gte('created_at', opts.fromDate)
    if (opts.toDate) query = query.lte('created_at', opts.toDate)
    if (opts.limit) query = query.limit(opts.limit)
    if (opts.offset) query = query.range(opts.offset, opts.offset + (opts.limit ?? 50) - 1)

    const { data, error } = await query
    if (error) return err(toAppError(error))

    const parsed = z.array(SaleSchema).safeParse(data)
    if (!parsed.success) return err(toAppError(parsed.error))

    return ok(parsed.data)
  } catch (e) {
    return err(toAppError(e))
  }
}

export async function getSaleById(
  client: SupabaseClient,
  id: string
): Promise<Result<{ sale: Sale; items: SaleItem[] }>> {
  try {
    const [saleResult, itemsResult] = await Promise.all([
      client.from('sales').select('*').eq('id', id).single(),
      client
        .from('sale_items')
        .select('*, medications_master(name)')
        .eq('sale_id', id),
    ])

    if (saleResult.error) return err(toAppError(saleResult.error))
    if (itemsResult.error) return err(toAppError(itemsResult.error))

    const saleParsed = SaleSchema.safeParse(saleResult.data)
    if (!saleParsed.success) return err(toAppError(saleParsed.error))

    // Flatten the nested medications_master join into medication_name
    const flatItems = (itemsResult.data ?? []).map((row: Record<string, unknown>) => {
      const med = row.medications_master as { name: string } | null
      const { medications_master: _drop, ...rest } = row
      return { ...rest, medication_name: med?.name }
    })

    const itemsParsed = z.array(SaleItemSchema).safeParse(flatItems)
    if (!itemsParsed.success) return err(toAppError(itemsParsed.error))

    return ok({ sale: saleParsed.data, items: itemsParsed.data })
  } catch (e) {
    return err(toAppError(e))
  }
}

/** Mark an unsynced local sale as voided (before it reaches the server) */
export async function voidSale(
  client: SupabaseClient,
  id: string
): Promise<Result<Sale>> {
  try {
    const { data, error } = await client
      .from('sales')
      .update({ status: 'voided' })
      .eq('id', id)
      .select()
      .single()

    if (error) return err(toAppError(error))

    const parsed = SaleSchema.safeParse(data)
    if (!parsed.success) return err(toAppError(parsed.error))

    return ok(parsed.data)
  } catch (e) {
    return err(toAppError(e))
  }
}
