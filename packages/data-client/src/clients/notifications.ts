import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { ok, err, type Result } from '../lib/result'
import { toAppError } from '../lib/errors'
import { NotificationSchema, type Notification } from '../schemas/notifications'

export interface GetNotificationsOptions {
  branchId?: string
  unreadOnly?: boolean
  severity?: 'info' | 'warning' | 'critical'
  limit?: number
}

export async function getNotifications(
  client: SupabaseClient,
  organizationId: string,
  opts: GetNotificationsOptions = {}
): Promise<Result<Notification[]>> {
  try {
    let query = client
      .from('notifications')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(opts.limit ?? 50)

    if (opts.branchId) query = query.eq('branch_id', opts.branchId)
    if (opts.unreadOnly) query = query.eq('is_read', false)
    if (opts.severity) query = query.eq('severity', opts.severity)

    const { data, error } = await query
    if (error) return err(toAppError(error))

    const parsed = z.array(NotificationSchema).safeParse(data)
    if (!parsed.success) return err(toAppError(parsed.error))

    return ok(parsed.data)
  } catch (e) {
    return err(toAppError(e))
  }
}

export async function markNotificationRead(
  client: SupabaseClient,
  id: string
): Promise<Result<Notification>> {
  try {
    const { data, error } = await client
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .select()
      .single()

    if (error) return err(toAppError(error))

    const parsed = NotificationSchema.safeParse(data)
    if (!parsed.success) return err(toAppError(parsed.error))

    return ok(parsed.data)
  } catch (e) {
    return err(toAppError(e))
  }
}

export async function markAllNotificationsRead(
  client: SupabaseClient,
  organizationId: string,
  branchId?: string
): Promise<Result<number>> {
  try {
    let query = client
      .from('notifications')
      .update({ is_read: true })
      .eq('organization_id', organizationId)
      .eq('is_read', false)

    if (branchId) query = query.eq('branch_id', branchId)

    const { count, error } = await query
    if (error) return err(toAppError(error))

    return ok(count ?? 0)
  } catch (e) {
    return err(toAppError(e))
  }
}
