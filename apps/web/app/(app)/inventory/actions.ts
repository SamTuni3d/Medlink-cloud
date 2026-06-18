'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { updateMedication } from '@medlink/data-client'

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } }

const UpdatePriceSchema = z.object({
  medicationId: z.string().uuid(),
  price: z.number().min(0),
})

export async function updateMedicationPriceAction(
  medicationId: string,
  price: number
): Promise<ActionResult> {
  const parsed = UpdatePriceSchema.safeParse({ medicationId, price })
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid price value.' } }
  }

  const result = await updateMedication(await createClient(), parsed.data.medicationId, {
    selling_price: parsed.data.price,
  })

  if (!result.ok) return { ok: false, error: result.error }

  revalidatePath('/inventory')
  return { ok: true, data: undefined }
}
