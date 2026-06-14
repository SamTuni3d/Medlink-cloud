import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { ok, err, type Result } from '../lib/result'
import { toAppError } from '../lib/errors'
import {
  AuditLogSchema,
  AuditLogInsertSchema,
  type AuditLog,
  type AuditLogInsert,
} from '../schemas/audit'

export interface GetAuditLogOptions {
  branchId?: string
  tableName?: string
  actorId?: string
  fromDate?: string
  toDate?: string
  limit?: number
  offset?: number
}

export async function getAuditLog(
  client: SupabaseClient,
  organizationId: string,
  opts: GetAuditLogOptions = {}
): Promise<Result<AuditLog[]>> {
  try {
    const limit = opts.limit ?? 100

    let query = client
      .from('audit_logs')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (opts.branchId) query = query.eq('branch_id', opts.branchId)
    if (opts.tableName) query = query.eq('table_name', opts.tableName)
    if (opts.actorId) query = query.eq('actor_id', opts.actorId)
    if (opts.fromDate) query = query.gte('created_at', opts.fromDate)
    if (opts.toDate) query = query.lte('created_at', opts.toDate)
    if (opts.offset) query = query.range(opts.offset, opts.offset + limit - 1)

    const { data, error } = await query
    if (error) return err(toAppError(error))

    const parsed = z.array(AuditLogSchema).safeParse(data)
    if (!parsed.success) return err(toAppError(parsed.error))

    return ok(parsed.data)
  } catch (e) {
    return err(toAppError(e))
  }
}

/** Append a single audit entry. audit_logs is insert-only — no update/delete RLS policy */
export async function appendAuditEntry(
  client: SupabaseClient,
  input: AuditLogInsert
): Promise<Result<AuditLog>> {
  try {
    const validated = AuditLogInsertSchema.safeParse(input)
    if (!validated.success) return err(toAppError(validated.error))

    const { data, error } = await client
      .from('audit_logs')
      .insert(validated.data)
      .select()
      .single()

    if (error) return err(toAppError(error))

    const parsed = AuditLogSchema.safeParse(data)
    if (!parsed.success) return err(toAppError(parsed.error))

    return ok(parsed.data)
  } catch (e) {
    return err(toAppError(e))
  }
}
