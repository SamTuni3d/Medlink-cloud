'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, requireRole } from '@/lib/auth/requireRole'
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

// Auditors are read-only — they cannot clock in or out
const CLOCK_ROLES = ['super_admin', 'org_admin', 'branch_manager', 'pharmacist', 'cashier', 'inventory_manager']

// ── Clock In ──────────────────────────────────────────────────────────────────
export async function clockInAction(branchId: string): Promise<ActionResult<DutySession>> {
  if (!branchId) return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Branch required' } }

  const client = await createClient()
  const auth = await requireAuth(client)
  if (!auth.ok) return auth

  const roleCheck = await requireRole(client, auth.userId, CLOCK_ROLES)
  if (!roleCheck.ok) return roleCheck

  const { data: userRow } = await client
    .from('users')
    .select('organization_id')
    .eq('id', auth.userId)
    .single()

  if (!userRow) return { ok: false, error: { code: 'UNAUTHORIZED', message: 'User has no organization' } }

  const result = await clockIn(client, {
    organization_id: userRow.organization_id,
    branch_id: branchId,
    user_id: auth.userId,
    clocked_in_by: auth.userId,
  })

  if (!result.ok) return { ok: false, error: result.error }

  revalidatePath('/duty-sessions')
  return { ok: true, data: result.data }
}

// ── Clock Out ─────────────────────────────────────────────────────────────────
export async function clockOutAction(sessionId: string): Promise<ActionResult> {
  if (!sessionId) return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Session ID required' } }

  const client = await createClient()
  const auth = await requireAuth(client)
  if (!auth.ok) return auth

  const roleCheck = await requireRole(client, auth.userId, CLOCK_ROLES)
  if (!roleCheck.ok) return roleCheck

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
