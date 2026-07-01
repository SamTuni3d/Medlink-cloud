'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { voidSale } from '@medlink/data-client'

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } }

const VoidSaleSchema = z.object({
  saleId:   z.string().uuid(),
  voidedBy: z.string().uuid(),
})

export async function voidSaleAction(
  input: z.infer<typeof VoidSaleSchema>
): Promise<ActionResult> {
  const parsed = VoidSaleSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input.' } }
  }

  const result = await voidSale(await createClient(), parsed.data.saleId, parsed.data.voidedBy)
  if (!result.ok) return { ok: false, error: result.error }

  revalidatePath('/sales')
  revalidatePath('/inventory')
  revalidatePath('/dashboard')
  return { ok: true, data: undefined }
}
