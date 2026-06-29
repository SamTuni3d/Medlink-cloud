'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { approveSuggestion, rejectSuggestion } from '@medlink/data-client'

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } }

// Both actions require the caller to be super_admin.
// The admin client is used so RLS (which is insufficient for status updates) is bypassed.

async function assertSuperAdmin(): Promise<{ userId: string } | null> {
  const client = await createClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) return null

  const role = user.user_metadata?.roles as string[] | string | undefined
  const roles = Array.isArray(role) ? role : [role]
  if (!roles.includes('super_admin')) return null

  return { userId: user.id }
}

export async function approveSuggestionAction(
  libraryId: string
): Promise<ActionResult> {
  const caller = await assertSuperAdmin()
  if (!caller) {
    return { ok: false, error: { code: 'UNAUTHORIZED', message: 'super_admin role required' } }
  }

  const admin = createAdminClient()
  const result = await approveSuggestion(admin, { libraryId, reviewerId: caller.userId })
  if (!result.ok) return { ok: false, error: result.error }
  return { ok: true, data: undefined }
}

export async function rejectSuggestionAction(
  libraryId: string,
  note: string
): Promise<ActionResult> {
  if (!note.trim()) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Rejection reason is required' } }
  }

  const caller = await assertSuperAdmin()
  if (!caller) {
    return { ok: false, error: { code: 'UNAUTHORIZED', message: 'super_admin role required' } }
  }

  const admin = createAdminClient()
  const result = await rejectSuggestion(admin, { libraryId, reviewerId: caller.userId, note: note.trim() })
  if (!result.ok) return { ok: false, error: result.error }
  return { ok: true, data: undefined }
}
