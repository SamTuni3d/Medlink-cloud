import Dexie, { type Table } from 'dexie'

// ─── Table shapes ────────────────────────────────────────────────────────────

export interface PendingSale {
  id: string
  device_id: string
  branch_id: string
  organization_id: string
  cashier_id: string
  sale_number: string
  status: 'completed' | 'voided'
  subtotal: number
  discount_amount: number
  tax_amount: number
  total_amount: number
  currency_code: string
  payment_method: 'cash' | 'card' | 'mobile_money' | 'credit'
  amount_tendered: number | null
  change_given: number | null
  prescription_number: string | null
  customer_name: string | null
  created_at: string
  sync_status: 'pending' | 'syncing' | 'synced' | 'failed'
  sync_error: string | null
}

export interface PendingSaleItem {
  id: string
  sale_id: string
  medication_id: string
  medication_name: string
  batch_id: string | null
  quantity: number
  unit_price: number
  discount_percent: number
  line_total: number
  currency_code: string
}

export interface MedicationCache {
  id: string
  organization_id: string
  name: string
  generic_name: string | null
  brand_name: string | null
  dosage_form: string
  strength: string | null
  unit_of_measure: string
  barcode: string | null
  category: string | null
  requires_prescription: boolean
  selling_price: number
  currency_code: string
  reorder_point: number
  is_active: boolean
  updated_seq: number
}

export interface InventoryCache {
  inventory_id: string
  branch_id: string
  medication_id: string
  current_stock: number
  available_stock: number
  reorder_point: number
}

export interface InventoryBatchCache {
  id: string
  branch_id: string
  medication_id: string
  batch_number: string
  expiry_date: string | null
  quantity_remaining: number
  currency_code: string
  received_at: string
  updated_seq: number
}

// ─── Database class ───────────────────────────────────────────────────────────

export class MedLinkDB extends Dexie {
  pending_sales!: Table<PendingSale>
  pending_sale_items!: Table<PendingSaleItem>
  medications_cache!: Table<MedicationCache>
  inventory_cache!: Table<InventoryCache>
  inventory_batches_cache!: Table<InventoryBatchCache>

  constructor() {
    super('medlink_pos')
    this.version(1).stores({
      pending_sales:
        'id, device_id, branch_id, sync_status, created_at',
      pending_sale_items:
        'id, sale_id, medication_id',
      medications_cache:
        'id, organization_id, [organization_id+is_active], barcode',
      inventory_cache:
        'inventory_id, [branch_id+medication_id], branch_id, medication_id',
      inventory_batches_cache:
        'id, [branch_id+medication_id], branch_id, medication_id, expiry_date',
    })
  }
}

// Singleton — safe to import anywhere in the browser
export const db = new MedLinkDB()
