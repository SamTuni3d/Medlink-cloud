import { z } from 'zod'

export const PrescriptionStatusSchema = z.enum([
  'pending',
  'partially_dispensed',
  'dispensed',
  'cancelled',
  'expired',
])
export type PrescriptionStatus = z.infer<typeof PrescriptionStatusSchema>

export const PrescriptionItemStatusSchema = z.enum([
  'pending',
  'partial',
  'dispensed',
  'cancelled',
])
export type PrescriptionItemStatus = z.infer<typeof PrescriptionItemStatusSchema>

export const PrescriptionItemSchema = z.object({
  id: z.string().uuid(),
  prescription_id: z.string().uuid(),
  organization_id: z.string().uuid(),
  medication_id: z.string().uuid(),
  medication_name: z.string(),
  quantity_prescribed: z.number().int().positive(),
  quantity_dispensed: z.number().int().min(0),
  dosage_instructions: z.string().nullable(),
  duration_days: z.number().int().nullable(),
  status: PrescriptionItemStatusSchema,
  sale_id: z.string().uuid().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})
export type PrescriptionItem = z.infer<typeof PrescriptionItemSchema>

export const PrescriptionSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  branch_id: z.string().uuid(),
  rx_number: z.string(),
  patient_name: z.string(),
  patient_dob: z.string().nullable(),
  patient_phone: z.string().nullable(),
  prescriber_name: z.string(),
  prescriber_license: z.string().nullable(),
  prescriber_phone: z.string().nullable(),
  diagnosis: z.string().nullable(),
  status: PrescriptionStatusSchema,
  notes: z.string().nullable(),
  issued_date: z.string(),
  expiry_date: z.string().nullable(),
  dispensed_by: z.string().uuid().nullable(),
  dispensed_at: z.string().nullable(),
  created_by: z.string().uuid(),
  created_at: z.string(),
  updated_at: z.string(),
})
export type Prescription = z.infer<typeof PrescriptionSchema>

export const PrescriptionWithItemsSchema = PrescriptionSchema.extend({
  items: z.array(PrescriptionItemSchema),
})
export type PrescriptionWithItems = z.infer<typeof PrescriptionWithItemsSchema>

export const PrescriptionItemInsertSchema = z.object({
  medication_id: z.string().uuid(),
  medication_name: z.string().min(1),
  quantity_prescribed: z.number().int().min(1),
  dosage_instructions: z.string().nullable().optional(),
  duration_days: z.number().int().positive().nullable().optional(),
})
export type PrescriptionItemInsert = z.infer<typeof PrescriptionItemInsertSchema>

export const PrescriptionInsertSchema = z.object({
  branch_id: z.string().uuid(),
  patient_name: z.string().min(1).max(200),
  patient_dob: z.string().nullable().optional(),
  patient_phone: z.string().nullable().optional(),
  prescriber_name: z.string().min(1).max(200),
  prescriber_license: z.string().nullable().optional(),
  prescriber_phone: z.string().nullable().optional(),
  diagnosis: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  issued_date: z.string(),
  expiry_date: z.string().nullable().optional(),
  items: z.array(PrescriptionItemInsertSchema).min(1),
})
export type PrescriptionInsert = z.infer<typeof PrescriptionInsertSchema>

export const DispenseItemSchema = z.object({
  item_id: z.string().uuid(),
  quantity_to_dispense: z.number().int().min(1),
})

export const DispensePrescriptionSchema = z.object({
  prescription_id: z.string().uuid(),
  items: z.array(DispenseItemSchema).min(1),
})
export type DispensePrescriptionInput = z.infer<typeof DispensePrescriptionSchema>
