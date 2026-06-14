import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { ok, err, type Result } from '../lib/result'
import { toAppError } from '../lib/errors'
import {
  BranchSchema,
  BranchInsertSchema,
  type Branch,
  type BranchInsert,
} from '../schemas/branches'

export async function updateBranch(
  client: SupabaseClient,
  id: string,
  input: Partial<BranchInsert>
): Promise<Result<Branch>> {
  try {
    const { data, error } = await client
      .from('branches')
      .update(input)
      .eq('id', id)
      .select()
      .single()

    if (error) return err(toAppError(error))

    const parsed = BranchSchema.safeParse(data)
    if (!parsed.success) return err(toAppError(parsed.error))

    return ok(parsed.data)
  } catch (e) {
    return err(toAppError(e))
  }
}

export async function getBranches(
  client: SupabaseClient,
  organizationId: string,
  opts: { activeOnly?: boolean } = {}
): Promise<Result<Branch[]>> {
  try {
    let query = client
      .from('branches')
      .select('*')
      .eq('organization_id', organizationId)
      .order('name', { ascending: true })

    if (opts.activeOnly !== false) {
      query = query.eq('is_active', true)
    }

    const { data, error } = await query
    if (error) return err(toAppError(error))

    const parsed = z.array(BranchSchema).safeParse(data)
    if (!parsed.success) return err(toAppError(parsed.error))

    return ok(parsed.data)
  } catch (e) {
    return err(toAppError(e))
  }
}

export async function getBranchById(
  client: SupabaseClient,
  id: string
): Promise<Result<Branch>> {
  try {
    const { data, error } = await client
      .from('branches')
      .select('*')
      .eq('id', id)
      .single()

    if (error) return err(toAppError(error))

    const parsed = BranchSchema.safeParse(data)
    if (!parsed.success) return err(toAppError(parsed.error))

    return ok(parsed.data)
  } catch (e) {
    return err(toAppError(e))
  }
}

export async function createBranch(
  client: SupabaseClient,
  input: BranchInsert
): Promise<Result<Branch>> {
  try {
    const validated = BranchInsertSchema.safeParse(input)
    if (!validated.success) return err(toAppError(validated.error))

    const { data, error } = await client
      .from('branches')
      .insert(validated.data)
      .select()
      .single()

    if (error) return err(toAppError(error))

    const parsed = BranchSchema.safeParse(data)
    if (!parsed.success) return err(toAppError(parsed.error))

    return ok(parsed.data)
  } catch (e) {
    return err(toAppError(e))
  }
}
