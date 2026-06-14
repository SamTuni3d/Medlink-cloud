import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { ok, err, type Result } from '../lib/result'
import { toAppError } from '../lib/errors'
import {
  MedicationSchema,
  MedicationInsertSchema,
  MedicationUpdateSchema,
  type Medication,
  type MedicationInsert,
  type MedicationUpdate,
} from '../schemas/medications'

export interface GetMedicationsOptions {
  activeOnly?: boolean
  category?: string
  /** Pull only records with updated_seq > cursor (for sync) */
  cursor?: number
  limit?: number
}

export async function getMedications(
  client: SupabaseClient,
  organizationId: string,
  opts: GetMedicationsOptions = {}
): Promise<Result<Medication[]>> {
  try {
    let query = client
      .from('medications_master')
      .select('*')
      .eq('organization_id', organizationId)
      .order('name', { ascending: true })

    if (opts.activeOnly !== false) {
      query = query.eq('is_active', true)
    }
    if (opts.category) {
      query = query.eq('category', opts.category)
    }
    if (opts.cursor !== undefined) {
      query = query.gt('updated_seq', opts.cursor)
    }
    if (opts.limit) {
      query = query.limit(opts.limit)
    }

    const { data, error } = await query
    if (error) return err(toAppError(error))

    const parsed = z.array(MedicationSchema).safeParse(data)
    if (!parsed.success) return err(toAppError(parsed.error))

    return ok(parsed.data)
  } catch (e) {
    return err(toAppError(e))
  }
}

export async function getMedicationById(
  client: SupabaseClient,
  id: string
): Promise<Result<Medication>> {
  try {
    const { data, error } = await client
      .from('medications_master')
      .select('*')
      .eq('id', id)
      .single()

    if (error) return err(toAppError(error))

    const parsed = MedicationSchema.safeParse(data)
    if (!parsed.success) return err(toAppError(parsed.error))

    return ok(parsed.data)
  } catch (e) {
    return err(toAppError(e))
  }
}

/** Full-text search across name, generic_name, and brand_name */
export async function searchMedications(
  client: SupabaseClient,
  organizationId: string,
  searchQuery: string,
  limit = 20
): Promise<Result<Medication[]>> {
  try {
    const { data, error } = await client
      .from('medications_master')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .textSearch('fts', searchQuery, { type: 'websearch' })
      .limit(limit)

    if (error) return err(toAppError(error))

    const parsed = z.array(MedicationSchema).safeParse(data)
    if (!parsed.success) return err(toAppError(parsed.error))

    return ok(parsed.data)
  } catch (e) {
    return err(toAppError(e))
  }
}

export async function createMedication(
  client: SupabaseClient,
  input: MedicationInsert
): Promise<Result<Medication>> {
  try {
    const validated = MedicationInsertSchema.safeParse(input)
    if (!validated.success) return err(toAppError(validated.error))

    const { data, error } = await client
      .from('medications_master')
      .insert(validated.data)
      .select()
      .single()

    if (error) return err(toAppError(error))

    const parsed = MedicationSchema.safeParse(data)
    if (!parsed.success) return err(toAppError(parsed.error))

    return ok(parsed.data)
  } catch (e) {
    return err(toAppError(e))
  }
}

export async function updateMedication(
  client: SupabaseClient,
  id: string,
  input: MedicationUpdate
): Promise<Result<Medication>> {
  try {
    const validated = MedicationUpdateSchema.safeParse(input)
    if (!validated.success) return err(toAppError(validated.error))

    const { data, error } = await client
      .from('medications_master')
      .update(validated.data)
      .eq('id', id)
      .select()
      .single()

    if (error) return err(toAppError(error))

    const parsed = MedicationSchema.safeParse(data)
    if (!parsed.success) return err(toAppError(parsed.error))

    return ok(parsed.data)
  } catch (e) {
    return err(toAppError(e))
  }
}
