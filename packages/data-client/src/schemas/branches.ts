import { z } from 'zod'

export const BranchSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  name: z.string(),
  address: z.string().nullable(),
  phone: z.string().nullable(),
  is_active: z.boolean(),
  created_at: z.string(),
})

export type Branch = z.infer<typeof BranchSchema>

export const BranchInsertSchema = z.object({
  organization_id: z.string().uuid(),
  name: z.string().min(1),
  address: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
})

export type BranchInsert = z.infer<typeof BranchInsertSchema>
