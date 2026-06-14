import { z } from 'zod'

export const OrganizationSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  registration_number: z.string().nullable(),
  country: z.string(),
  city: z.string().nullable(),
  currency_code: z.string().length(3),
  subscription_tier: z.string().nullable(),
  created_at: z.string(),
})

export type Organization = z.infer<typeof OrganizationSchema>

export const OrganizationInsertSchema = z.object({
  name: z.string().min(2),
  registration_number: z.string().nullable().optional(),
  country: z.string().min(2),
  city: z.string().nullable().optional(),
  currency_code: z.string().length(3).default('GHS'),
  subscription_tier: z.string().nullable().optional(),
})

export type OrganizationInsert = z.infer<typeof OrganizationInsertSchema>

export const OrganizationUpdateSchema = OrganizationInsertSchema.partial()
export type OrganizationUpdate = z.infer<typeof OrganizationUpdateSchema>
