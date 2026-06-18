import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { ok, err, type Result } from '../lib/result'
import { toAppError } from '../lib/errors'

const DutySessionSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  branch_id: z.string().uuid(),
  user_id: z.string().uuid(),
  clocked_in_at: z.string(),
  clocked_out_at: z.string().nullable(),
  clocked_in_by: z.string().uuid().nullable(),
  notes: z.string().nullable(),
  created_at: z.string(),
})

export type DutySession = z.infer<typeof DutySessionSchema>

const DutySessionWithUserSchema = DutySessionSchema.extend({
  user_name: z.string(),
  user_email: z.string(),
})

export type DutySessionWithUser = z.infer<typeof DutySessionWithUserSchema>

function flattenUserJoin(data: Record<string, unknown>[]) {
  return data.map(row => {
    const user = row['users'] as { full_name: string; email: string } | null
    const { users: _drop, ...rest } = row
    return { ...rest, user_name: user?.full_name ?? 'Unknown', user_email: user?.email ?? '' }
  })
}

export async function getActiveDutySessions(
  client: SupabaseClient,
  branchId: string
): Promise<Result<DutySessionWithUser[]>> {
  try {
    const { data, error } = await client
      .from('duty_sessions')
      .select('*, users!user_id(full_name, email)')
      .eq('branch_id', branchId)
      .is('clocked_out_at', null)
      .order('clocked_in_at', { ascending: true })

    if (error) return err(toAppError(error))

    const parsed = z.array(DutySessionWithUserSchema).safeParse(
      flattenUserJoin((data ?? []) as Record<string, unknown>[])
    )
    if (!parsed.success) return err(toAppError(parsed.error))

    return ok(parsed.data)
  } catch (e) {
    return err(toAppError(e))
  }
}

export async function clockIn(
  client: SupabaseClient,
  input: {
    organization_id: string
    branch_id: string
    user_id: string
    clocked_in_by?: string | null
    notes?: string | null
  }
): Promise<Result<DutySession>> {
  try {
    const { data, error } = await client
      .from('duty_sessions')
      .insert({
        organization_id: input.organization_id,
        branch_id: input.branch_id,
        user_id: input.user_id,
        clocked_in_by: input.clocked_in_by ?? null,
        notes: input.notes ?? null,
      })
      .select()
      .single()

    if (error) return err(toAppError(error))

    const parsed = DutySessionSchema.safeParse(data)
    if (!parsed.success) return err(toAppError(parsed.error))

    return ok(parsed.data)
  } catch (e) {
    return err(toAppError(e))
  }
}

export async function clockOut(
  client: SupabaseClient,
  sessionId: string
): Promise<Result<DutySession>> {
  try {
    const { data, error } = await client
      .from('duty_sessions')
      .update({ clocked_out_at: new Date().toISOString() })
      .eq('id', sessionId)
      .select()
      .single()

    if (error) return err(toAppError(error))

    const parsed = DutySessionSchema.safeParse(data)
    if (!parsed.success) return err(toAppError(parsed.error))

    return ok(parsed.data)
  } catch (e) {
    return err(toAppError(e))
  }
}

export interface GetDutyHistoryOptions {
  userId?: string
  limit?: number
  offset?: number
}

export async function getDutyHistory(
  client: SupabaseClient,
  branchId: string,
  opts: GetDutyHistoryOptions = {}
): Promise<Result<DutySessionWithUser[]>> {
  try {
    let query = client
      .from('duty_sessions')
      .select('*, users!user_id(full_name, email)')
      .eq('branch_id', branchId)
      .order('clocked_in_at', { ascending: false })
      .limit(opts.limit ?? 50)

    if (opts.userId) query = query.eq('user_id', opts.userId)
    if (opts.offset) query = query.range(opts.offset, opts.offset + (opts.limit ?? 50) - 1)

    const { data, error } = await query

    if (error) return err(toAppError(error))

    const parsed = z.array(DutySessionWithUserSchema).safeParse(
      flattenUserJoin((data ?? []) as Record<string, unknown>[])
    )
    if (!parsed.success) return err(toAppError(parsed.error))

    return ok(parsed.data)
  } catch (e) {
    return err(toAppError(e))
  }
}
