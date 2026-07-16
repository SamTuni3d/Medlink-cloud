'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import {
  getPrescriptions,
  getPrescription,
  createPrescription,
  dispensePrescription,
  cancelPrescription,
} from '@medlink/data-client'
import type { PrescriptionStatus } from '@medlink/data-client'

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } }

const ItemSchema = z.object({
  medication_id: z.string().uuid(),
  medication_name: z.string().min(1),
  quantity_prescribed: z.coerce.number().int().min(1),
  dosage_instructions: z.string().optional(),
  duration_days: z.coerce.number().int().positive().optional(),
})

const CreatePrescriptionSchema = z.object({
  branch_id: z.string().uuid(),
  patient_name: z.string().min(1).max(200),
  patient_dob: z.string().optional(),
  patient_phone: z.string().optional(),
  prescriber_name: z.string().min(1).max(200),
  prescriber_license: z.string().optional(),
  prescriber_phone: z.string().optional(),
  diagnosis: z.string().optional(),
  notes: z.string().optional(),
  issued_date: z.string().min(1),
  expiry_date: z.string().optional(),
  items: z.array(ItemSchema).min(1),
})

export async function createPrescriptionAction(
  input: z.infer<typeof CreatePrescriptionSchema>
): Promise<ActionResult<{ id: string; rx_number: string }>> {
  const parsed = CreatePrescriptionSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input' } }
  }

  const client = await createClient()
  const { data: { user }, error: authError } = await client.auth.getUser()
  if (authError || !user) return { ok: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }

  const { data: orgRow } = await client
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!orgRow) return { ok: false, error: { code: 'UNAUTHORIZED', message: 'User has no organization' } }

  const result = await createPrescription(client, orgRow.organization_id, user.id, {
    ...parsed.data,
    patient_dob: parsed.data.patient_dob || null,
    patient_phone: parsed.data.patient_phone || null,
    prescriber_license: parsed.data.prescriber_license || null,
    prescriber_phone: parsed.data.prescriber_phone || null,
    diagnosis: parsed.data.diagnosis || null,
    notes: parsed.data.notes || null,
    expiry_date: parsed.data.expiry_date || null,
    items: parsed.data.items.map(item => ({
      ...item,
      dosage_instructions: item.dosage_instructions || null,
      duration_days: item.duration_days ?? null,
    })),
  })

  if (!result.ok) return { ok: false, error: result.error }

  revalidatePath('/prescriptions')
  return { ok: true, data: result.data }
}

const DispenseItemSchema = z.object({
  item_id: z.string().uuid(),
  quantity_to_dispense: z.coerce.number().int().min(1),
})

const DispenseSchema = z.object({
  prescription_id: z.string().uuid(),
  items: z.array(DispenseItemSchema).min(1),
})

export async function dispensePrescriptionAction(
  input: z.infer<typeof DispenseSchema>
): Promise<ActionResult> {
  const parsed = DispenseSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input' } }
  }

  const client = await createClient()
  const { data: { user }, error: authError } = await client.auth.getUser()
  if (authError || !user) return { ok: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }

  const result = await dispensePrescription(client, user.id, parsed.data)
  if (!result.ok) return { ok: false, error: result.error }

  revalidatePath('/prescriptions')
  return { ok: true, data: undefined }
}

export async function cancelPrescriptionAction(id: string): Promise<ActionResult> {
  if (!id) return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'ID required' } }

  const client = await createClient()
  const result = await cancelPrescription(client, id)
  if (!result.ok) return { ok: false, error: result.error }

  revalidatePath('/prescriptions')
  return { ok: true, data: undefined }
}

export async function getPrescriptionsAction(
  branchId: string,
  opts?: { status?: PrescriptionStatus; search?: string }
) {
  const client = await createClient()
  return getPrescriptions(client, branchId, opts)
}

export async function getPrescriptionAction(id: string) {
  const client = await createClient()
  return getPrescription(client, id)
}
