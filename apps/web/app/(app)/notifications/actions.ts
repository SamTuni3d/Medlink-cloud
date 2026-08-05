'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { markNotificationRead, markAllNotificationsRead } from '@medlink/data-client'

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } }

export async function markNotificationReadAction(id: string): Promise<ActionResult> {
  if (!id) return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'ID required' } }
  const client = await createClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) return { ok: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }

  const result = await markNotificationRead(client, id)
  if (!result.ok) return { ok: false, error: result.error }
  revalidatePath('/notifications')
  return { ok: true, data: undefined }
}

export async function markAllNotificationsReadAction(branchId?: string): Promise<ActionResult<{ count: number }>> {
  const client = await createClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) return { ok: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }

  const { data: userRow } = await client
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()
  if (!userRow) return { ok: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }

  const result = await markAllNotificationsRead(client, userRow.organization_id as string, branchId)
  if (!result.ok) return { ok: false, error: result.error }
  revalidatePath('/notifications')
  return { ok: true, data: { count: result.data } }
}
