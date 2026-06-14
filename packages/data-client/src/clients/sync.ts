import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { ok, err, type Result } from '../lib/result'
import { toAppError } from '../lib/errors'
import {
  SyncCursorSchema,
  SyncCursorUpsertSchema,
  type SyncCursor,
  type SyncCursorUpsert,
} from '../schemas/sync'
import { getMedications } from './medications'
import type { Medication } from '../schemas/medications'

export async function getSyncCursor(
  client: SupabaseClient,
  deviceId: string,
  tableName: string
): Promise<Result<SyncCursor | null>> {
  try {
    const { data, error } = await client
      .from('sync_cursors')
      .select('*')
      .eq('device_id', deviceId)
      .eq('table_name', tableName)
      .maybeSingle()

    if (error) return err(toAppError(error))
    if (!data) return ok(null)

    const parsed = SyncCursorSchema.safeParse(data)
    if (!parsed.success) return err(toAppError(parsed.error))

    return ok(parsed.data)
  } catch (e) {
    return err(toAppError(e))
  }
}

export async function upsertSyncCursor(
  client: SupabaseClient,
  input: SyncCursorUpsert
): Promise<Result<SyncCursor>> {
  try {
    const validated = SyncCursorUpsertSchema.safeParse(input)
    if (!validated.success) return err(toAppError(validated.error))

    const { data, error } = await client
      .from('sync_cursors')
      .upsert(validated.data, { onConflict: 'device_id,table_name' })
      .select()
      .single()

    if (error) return err(toAppError(error))

    const parsed = SyncCursorSchema.safeParse(data)
    if (!parsed.success) return err(toAppError(parsed.error))

    return ok(parsed.data)
  } catch (e) {
    return err(toAppError(e))
  }
}

/**
 * Pull medications updated since cursor for this device's org.
 * Returns new rows and the max updated_seq seen (use as next cursor).
 */
export async function pullMedications(
  client: SupabaseClient,
  organizationId: string,
  cursor: number,
  limit = 200
): Promise<Result<{ rows: Medication[]; nextCursor: number }>> {
  const result = await getMedications(client, organizationId, {
    activeOnly: false,
    cursor,
    limit,
  })

  if (!result.ok) return result

  const rows = result.data
  const nextCursor =
    rows.length > 0
      ? Math.max(...rows.map(r => r.updated_seq))
      : cursor

  return ok({ rows, nextCursor })
}

/** All syncable table names, matched to the sequence column that drives cursor-based pull */
export const SYNC_TABLES = ['medications_master', 'inventory', 'inventory_batches'] as const

export type SyncTableName = typeof SYNC_TABLES[number]

export function isSyncTable(name: string): name is SyncTableName {
  return (SYNC_TABLES as readonly string[]).includes(name)
}
