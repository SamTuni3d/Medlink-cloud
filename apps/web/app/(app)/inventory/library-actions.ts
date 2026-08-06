'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/requireRole'
import {
  importFromLibrary,
  suggestMedication,
  approveSuggestion,
  rejectSuggestion,
  ImportItemSchema,
  SuggestMedicationSchema,
} from '@medlink/data-client'
import type { ActionResult } from './actions'

const ImportFromLibraryInputSchema = z.object({
  organizationId: z.string().uuid(),
  branchId:       z.string().uuid(),
  currencyCode:   z.string().min(1).max(10).default('GHS'),
  items:          z.array(ImportItemSchema).min(1),
})

export async function importFromLibraryAction(
  input: z.infer<typeof ImportFromLibraryInputSchema>
): Promise<ActionResult<{ created: number; skipped: number; errors: string[] }>> {
  const parsed = ImportFromLibraryInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input.' } }
  }

  const client = await createClient()
  const auth = await requireAuth(client)
  if (!auth.ok) return auth

  const result = await importFromLibrary(client, { ...parsed.data, userId: auth.userId })
  if (!result.ok) return { ok: false, error: result.error }

  revalidatePath('/inventory')
  return { ok: true, data: result.data }
}

const SuggestInputSchema = SuggestMedicationSchema

export async function suggestMedicationAction(
  input: z.infer<typeof SuggestInputSchema>
): Promise<ActionResult> {
  const parsed = SuggestInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input.' } }
  }

  const client = await createClient()
  const auth = await requireAuth(client)
  if (!auth.ok) return auth

  const result = await suggestMedication(client, { ...parsed.data, suggestedBy: auth.userId })
  if (!result.ok) return { ok: false, error: result.error }

  return { ok: true, data: undefined }
}

const ApproveInputSchema = z.object({
  libraryId: z.string().uuid(),
})

export async function approveSuggestionAction(
  input: z.infer<typeof ApproveInputSchema>
): Promise<ActionResult> {
  const parsed = ApproveInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input.' } }
  }

  const client = await createClient()
  const auth = await requireAuth(client)
  if (!auth.ok) return auth

  const result = await approveSuggestion(client, { libraryId: parsed.data.libraryId, reviewerId: auth.userId })
  if (!result.ok) return { ok: false, error: result.error }

  revalidatePath('/admin/library')
  return { ok: true, data: undefined }
}

const RejectInputSchema = z.object({
  libraryId: z.string().uuid(),
  note:      z.string().min(1, 'Rejection note is required.'),
})

export async function rejectSuggestionAction(
  input: z.infer<typeof RejectInputSchema>
): Promise<ActionResult> {
  const parsed = RejectInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input.' } }
  }

  const client = await createClient()
  const auth = await requireAuth(client)
  if (!auth.ok) return auth

  const result = await rejectSuggestion(client, { libraryId: parsed.data.libraryId, reviewerId: auth.userId, note: parsed.data.note })
  if (!result.ok) return { ok: false, error: result.error }

  revalidatePath('/admin/library')
  return { ok: true, data: undefined }
}
