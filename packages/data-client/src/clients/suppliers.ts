import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { ok, err, type Result } from '../lib/result'
import { toAppError } from '../lib/errors'
import {
  SupplierSchema,
  SupplierInsertSchema,
  type Supplier,
  type SupplierInsert,
} from '../schemas/suppliers'

export async function getSuppliers(
  client: SupabaseClient,
  organizationId: string,
): Promise<Result<Supplier[]>> {
  try {
    const { data, error } = await client
      .from('suppliers')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (error) return err(toAppError(error))

    const parsed = z.array(SupplierSchema).safeParse(data)
    if (!parsed.success) return err(toAppError(parsed.error))

    return ok(parsed.data)
  } catch (e) {
    return err(toAppError(e))
  }
}

export async function createSupplier(
  client: SupabaseClient,
  input: SupplierInsert,
): Promise<Result<Supplier>> {
  try {
    const validated = SupplierInsertSchema.parse(input)
    const { data, error } = await client
      .from('suppliers')
      .insert(validated)
      .select()
      .single()

    if (error) return err(toAppError(error))

    const parsed = SupplierSchema.safeParse(data)
    if (!parsed.success) return err(toAppError(parsed.error))

    return ok(parsed.data)
  } catch (e) {
    return err(toAppError(e))
  }
}

export async function updateSupplier(
  client: SupabaseClient,
  id: string,
  input: Partial<Omit<SupplierInsert, 'organization_id'>>,
): Promise<Result<Supplier>> {
  try {
    const { data, error } = await client
      .from('suppliers')
      .update(input)
      .eq('id', id)
      .select()
      .single()

    if (error) return err(toAppError(error))

    const parsed = SupplierSchema.safeParse(data)
    if (!parsed.success) return err(toAppError(parsed.error))

    return ok(parsed.data)
  } catch (e) {
    return err(toAppError(e))
  }
}

export async function softDeleteSupplier(
  client: SupabaseClient,
  id: string,
): Promise<Result<void>> {
  try {
    const { error } = await client
      .from('suppliers')
      .update({ is_active: false })
      .eq('id', id)

    if (error) return err(toAppError(error))

    return ok(undefined)
  } catch (e) {
    return err(toAppError(e))
  }
}
