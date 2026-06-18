import { z } from 'zod'

export const MedicationSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  name: z.string(),
  generic_name: z.string().nullable(),
  brand_name: z.string().nullable(),
  dosage_form: z.string().nullable().transform(v => v ?? 'Other'),
  strength: z.string().nullable(),
  unit_of_measure: z.string(),
  barcode: z.string().nullable(),
  category: z.string().nullable(),
  requires_prescription: z.boolean(),
  reorder_point: z.number().int(),
  reorder_quantity: z.number().int(),
  selling_price: z.number(),
  currency_code: z.string().length(3),
  is_active: z.boolean(),
  updated_at: z.string(),
  updated_seq: z.number().int(),
})

export type Medication = z.infer<typeof MedicationSchema>

export const MedicationInsertSchema = z.object({
  organization_id: z.string().uuid(),
  name: z.string().min(1),
  generic_name: z.string().nullable().optional(),
  brand_name: z.string().nullable().optional(),
  dosage_form: z.string().min(1),
  strength: z.string().nullable().optional(),
  unit_of_measure: z.string().min(1),
  barcode: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  requires_prescription: z.boolean().default(false),
  reorder_point: z.number().int().min(0),
  reorder_quantity: z.number().int().min(1),
  selling_price: z.number().min(0),
  currency_code: z.string().length(3),
})

export type MedicationInsert = z.infer<typeof MedicationInsertSchema>

export const MedicationUpdateSchema = MedicationInsertSchema.omit({ organization_id: true }).partial()

export type MedicationUpdate = z.infer<typeof MedicationUpdateSchema>
