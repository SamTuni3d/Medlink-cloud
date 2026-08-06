'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, requireRole } from '@/lib/auth/requireRole'
import { voidSale } from '@medlink/data-client'

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } }

const VOID_ROLES = ['branch_manager', 'org_admin', 'super_admin']

const VoidSaleSchema = z.object({
  saleId: z.string().uuid(),
})

export async function voidSaleAction(
  input: z.infer<typeof VoidSaleSchema>
): Promise<ActionResult> {
  const parsed = VoidSaleSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input.' } }
  }

  const client = await createClient()

  const auth = await requireAuth(client)
  if (!auth.ok) return auth

  const roleCheck = await requireRole(client, auth.userId, VOID_ROLES)
  if (!roleCheck.ok) return roleCheck

  const result = await voidSale(client, parsed.data.saleId, auth.userId)
  if (!result.ok) return { ok: false, error: result.error }

  revalidatePath('/sales')
  revalidatePath('/inventory')
  revalidatePath('/dashboard')
  return { ok: true, data: undefined }
}
