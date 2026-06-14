import { z } from 'zod'

export const InventorySchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  branch_id: z.string().uuid(),
  medication_id: z.string().uuid(),
  current_stock: z.number().int(),
  reserved_stock: z.number().int(),
  last_reconciled_at: z.string().nullable(),
  updated_at: z.string(),
  updated_seq: z.number().int(),
})

export type Inventory = z.infer<typeof InventorySchema>

export const InventoryWithBatchesSchema = z.object({
  inventory_id: z.string().uuid(),
  organization_id: z.string().uuid(),
  branch_id: z.string().uuid(),
  medication_id: z.string().uuid(),
  current_stock: z.number().int(),
  reserved_stock: z.number().int(),
  available_stock: z.number().int(),
  medication_name: z.string(),
  generic_name: z.string().nullable(),
  dosage_form: z.string(),
  strength: z.string().nullable(),
  unit_of_measure: z.string(),
  barcode: z.string().nullable(),
  category: z.string().nullable(),
  selling_price: z.number(),
  currency_code: z.string().length(3),
  reorder_point: z.number().int(),
  requires_prescription: z.boolean(),
  active_batch_count: z.number().int(),
  nearest_expiry_date: z.string().nullable(),
  days_to_nearest_expiry: z.number().nullable(),
  last_reconciled_at: z.string().nullable(),
  updated_at: z.string(),
})

export type InventoryWithBatches = z.infer<typeof InventoryWithBatchesSchema>

export const InventoryBatchSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  branch_id: z.string().uuid(),
  medication_id: z.string().uuid(),
  supplier_id: z.string().uuid().nullable(),
  batch_number: z.string(),
  expiry_date: z.string().nullable(),
  quantity_received: z.number().int(),
  quantity_remaining: z.number().int(),
  cost_price: z.number(),
  currency_code: z.string().length(3),
  received_at: z.string(),
  created_by: z.string().uuid().nullable(),
  updated_at: z.string(),
  updated_seq: z.number().int(),
})

export type InventoryBatch = z.infer<typeof InventoryBatchSchema>

export const InventoryBatchInsertSchema = z.object({
  organization_id: z.string().uuid(),
  branch_id: z.string().uuid(),
  medication_id: z.string().uuid(),
  supplier_id: z.string().uuid().nullable().optional(),
  batch_number: z.string().min(1),
  expiry_date: z.string().nullable().optional(),
  quantity_received: z.number().int().min(1),
  cost_price: z.number().min(0),
  currency_code: z.string().length(3),
  created_by: z.string().uuid().nullable().optional(),
})

export type InventoryBatchInsert = z.infer<typeof InventoryBatchInsertSchema>

export const MovementTypeSchema = z.enum([
  'receipt',
  'sale',
  'adjustment',
  'transfer_in',
  'transfer_out',
  'expiry_write_off',
  'opening_stock',
])

export type MovementType = z.infer<typeof MovementTypeSchema>

export const StockMovementSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  branch_id: z.string().uuid(),
  medication_id: z.string().uuid(),
  batch_id: z.string().uuid().nullable(),
  movement_type: MovementTypeSchema,
  delta: z.number().int(),
  reference_id: z.string().uuid().nullable(),
  notes: z.string().nullable(),
  performed_by: z.string().uuid().nullable(),
  created_at: z.string(),
})

export type StockMovement = z.infer<typeof StockMovementSchema>

export const StockMovementInsertSchema = z.object({
  organization_id: z.string().uuid(),
  branch_id: z.string().uuid(),
  medication_id: z.string().uuid(),
  batch_id: z.string().uuid().nullable().optional(),
  movement_type: MovementTypeSchema,
  delta: z.number().int(),
  reference_id: z.string().uuid().nullable().optional(),
  notes: z.string().nullable().optional(),
  performed_by: z.string().uuid().nullable().optional(),
})

export type StockMovementInsert = z.infer<typeof StockMovementInsertSchema>
