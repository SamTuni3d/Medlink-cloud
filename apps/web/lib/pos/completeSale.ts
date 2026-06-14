import { db, type PendingSale, type PendingSaleItem } from '@/lib/dexie/db'
import { getDeviceId } from './deviceId'
import { nextSaleNumber } from './saleNumber'

export interface CartItem {
  medicationId: string
  medicationName: string
  batchId: string | null
  quantity: number
  unitPrice: number
  currencyCode: string
  discountPercent: number
}

export interface CompleteSaleParams {
  branchId: string
  organizationId: string
  cashierId: string
  items: CartItem[]
  paymentMethod: PendingSale['payment_method']
  amountTendered: number | null
  customerName: string | null
  prescriptionNumber: string | null
  currencyCode: string
}

export interface CompletedSaleResult {
  saleId: string
  saleNumber: string
}

/**
 * Write a completed sale to Dexie immediately.
 *
 * Rule 2: this function MUST NOT await any Supabase call.
 * The only I/O here is IndexedDB (Dexie), which is synchronous to the UX.
 * The sync queue picks up the pending_sale and pushes to the server in the background.
 */
export async function completeSale(
  params: CompleteSaleParams
): Promise<CompletedSaleResult> {
  const {
    branchId,
    organizationId,
    cashierId,
    items,
    paymentMethod,
    amountTendered,
    customerName,
    prescriptionNumber,
    currencyCode,
  } = params

  const saleId = crypto.randomUUID()
  const saleNumber = nextSaleNumber(branchId)
  const now = new Date().toISOString()

  // Calculate totals
  const subtotal = items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity * (1 - item.discountPercent / 100),
    0
  )
  const subtotalRounded = Math.round(subtotal * 100) / 100
  const changeDue =
    paymentMethod === 'cash' && amountTendered !== null
      ? Math.max(0, Math.round((amountTendered - subtotalRounded) * 100) / 100)
      : null

  const sale: PendingSale = {
    id: saleId,
    device_id: getDeviceId(),
    branch_id: branchId,
    organization_id: organizationId,
    cashier_id: cashierId,
    sale_number: saleNumber,
    status: 'completed',
    subtotal: subtotalRounded,
    discount_amount: 0,
    tax_amount: 0,
    total_amount: subtotalRounded,
    currency_code: currencyCode,
    payment_method: paymentMethod,
    amount_tendered: amountTendered,
    change_given: changeDue,
    prescription_number: prescriptionNumber,
    customer_name: customerName,
    created_at: now,
    sync_status: 'pending',
    sync_error: null,
  }

  const saleItems: PendingSaleItem[] = items.map(item => ({
    id: crypto.randomUUID(),
    sale_id: saleId,
    medication_id: item.medicationId,
    medication_name: item.medicationName,
    batch_id: item.batchId,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    discount_percent: item.discountPercent,
    line_total: Math.round(item.unitPrice * item.quantity * (1 - item.discountPercent / 100) * 100) / 100,
    currency_code: item.currencyCode,
  }))

  // Atomic write to Dexie — this is the only I/O on the critical path
  await db.transaction('rw', [db.pending_sales, db.pending_sale_items], async () => {
    await db.pending_sales.add(sale)
    await db.pending_sale_items.bulkAdd(saleItems)
  })

  return { saleId, saleNumber }
}
