'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  clockIn,
  clockOut,
  getActiveDutySessions,
  getDutyHistory,
} from '@medlink/data-client'
import type { DutySession, DutySessionWithUser } from '@medlink/data-client'

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } }

// ── Clock In ──────────────────────────────────────────────────────────────────
export async function clockInAction(branchId: string): Promise<ActionResult<DutySession>> {
  if (!branchId) return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Branch required' } }

  const client = await createClient()
  const { data: { user }, error: authError } = await client.auth.getUser()
  if (authError || !user) return { ok: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }

  const { data: userRow } = await client
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!userRow) return { ok: false, error: { code: 'UNAUTHORIZED', message: 'User has no organization' } }

  const result = await clockIn(client, {
    organization_id: userRow.organization_id,
    branch_id: branchId,
    user_id: user.id,
    clocked_in_by: user.id,
  })

  if (!result.ok) return { ok: false, error: result.error }

  revalidatePath('/duty-sessions')
  return { ok: true, data: result.data }
}

// ── Clock Out ─────────────────────────────────────────────────────────────────
export async function clockOutAction(sessionId: string): Promise<ActionResult> {
  if (!sessionId) return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Session ID required' } }

  const client = await createClient()
  const { data: { user }, error: authError } = await client.auth.getUser()
  if (authError || !user) return { ok: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }

  const result = await clockOut(client, sessionId)
  if (!result.ok) return { ok: false, error: result.error }

  revalidatePath('/duty-sessions')
  return { ok: true, data: undefined }
}

// ── Read helpers (called from client components) ──────────────────────────────
export async function getActiveDutySessionsAction(
  branchId: string
): Promise<ActionResult<DutySessionWithUser[]>> {
  const client = await createClient()
  return getActiveDutySessions(client, branchId)
}

export async function getDutyHistoryAction(
  branchId: string,
  limit = 50
): Promise<ActionResult<DutySessionWithUser[]>> {
  const client = await createClient()
  return getDutyHistory(client, branchId, { limit })
}
