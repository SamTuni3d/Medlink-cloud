import { z } from 'zod'

export const PaymentMethodSchema = z.enum(['cash', 'card', 'mobile_money', 'credit'])
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>

export const SaleStatusSchema = z.enum(['pending', 'completed', 'voided'])
export type SaleStatus = z.infer<typeof SaleStatusSchema>

export const SaleSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  branch_id: z.string().uuid(),
  device_id: z.string().uuid(),
  cashier_id: z.string().uuid(),
  sale_number: z.string(),
  branch_sale_number: z.number().int().nullable(),
  status: SaleStatusSchema,
  subtotal: z.number(),
  discount_amount: z.number(),
  tax_amount: z.number(),
  total_amount: z.number(),
  currency_code: z.string().length(3),
  payment_method: PaymentMethodSchema,
  amount_tendered: z.number().nullable(),
  change_given: z.number().nullable(),
  prescription_number: z.string().nullable(),
  customer_name: z.string().nullable(),
  cashier_name: z.string().nullable().optional(), // populated via join in getSales/getSaleById
  synced_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})

export type Sale = z.infer<typeof SaleSchema>

export const SaleItemSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  sale_id: z.string().uuid(),
  medication_id: z.string().uuid(),
  medication_name: z.string().optional(), // populated via join in getSaleById
  batch_id: z.string().uuid().nullable(),
  quantity: z.number().int().positive(),
  unit_price: z.number().min(0),
  discount_percent: z.number().min(0).max(100),
  line_total: z.number().min(0),
  currency_code: z.string().length(3),
})

export type SaleItem = z.infer<typeof SaleItemSchema>

export const SaleInsertSchema = z.object({
  organization_id: z.string().uuid(),
  branch_id: z.string().uuid(),
  device_id: z.string().uuid(),
  cashier_id: z.string().uuid(),
  sale_number: z.string().min(1),
  status: SaleStatusSchema.default('completed'),
  subtotal: z.number().min(0),
  discount_amount: z.number().min(0).default(0),
  tax_amount: z.number().min(0).default(0),
  total_amount: z.number().min(0),
  currency_code: z.string().length(3),
  payment_method: PaymentMethodSchema,
  amount_tendered: z.number().min(0).nullable().optional(),
  change_given: z.number().min(0).nullable().optional(),
  prescription_number: z.string().nullable().optional(),
  customer_name: z.string().nullable().optional(),
  // Created_at from the device clock — preserved on sync so history is accurate
  created_at: z.string(),
})

export type SaleInsert = z.infer<typeof SaleInsertSchema>

export const SaleItemInsertSchema = z.object({
  medication_id: z.string().uuid(),
  batch_id: z.string().uuid().nullable().optional(),
  quantity: z.number().int().positive(),
  unit_price: z.number().min(0),
  discount_percent: z.number().min(0).max(100).default(0),
  line_total: z.number().min(0),
  currency_code: z.string().length(3),
})

export type SaleItemInsert = z.infer<typeof SaleItemInsertSchema>

export const RecordSaleInputSchema = z.object({
  sale: SaleInsertSchema,
  items: z.array(SaleItemInsertSchema).min(1),
})

export type RecordSaleInput = z.infer<typeof RecordSaleInputSchema>

export const RecordSaleOutputSchema = z.object({
  sale_id: z.string().uuid(),
})

export type RecordSaleOutput = z.infer<typeof RecordSaleOutputSchema>
