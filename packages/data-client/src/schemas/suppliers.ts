import { z } from 'zod'

export const SupplierSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  name: z.string(),
  contact_name: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  address: z.string().nullable(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
})

export type Supplier = z.infer<typeof SupplierSchema>

export const SupplierInsertSchema = z.object({
  organization_id: z.string().uuid(),
  name: z.string().min(1, 'Supplier name is required'),
  contact_name: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email('Invalid email').nullable().optional(),
  address: z.string().nullable().optional(),
})

export type SupplierInsert = z.infer<typeof SupplierInsertSchema>
