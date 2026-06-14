import type { SupabaseClient } from '@supabase/supabase-js'
import { ok, err, type Result } from '../lib/result'
import { toAppError } from '../lib/errors'
import {
  OrganizationSchema,
  OrganizationInsertSchema,
  OrganizationUpdateSchema,
  type Organization,
  type OrganizationInsert,
  type OrganizationUpdate,
} from '../schemas/organizations'

export async function getOrganization(
  client: SupabaseClient,
  id: string
): Promise<Result<Organization>> {
  try {
    const { data, error } = await client
      .from('organizations')
      .select('*')
      .eq('id', id)
      .single()

    if (error) return err(toAppError(error))

    const parsed = OrganizationSchema.safeParse(data)
    if (!parsed.success) return err(toAppError(parsed.error))

    return ok(parsed.data)
  } catch (e) {
    return err(toAppError(e))
  }
}

export async function createOrganization(
  client: SupabaseClient,
  input: OrganizationInsert
): Promise<Result<Organization>> {
  try {
    const validated = OrganizationInsertSchema.safeParse(input)
    if (!validated.success) return err(toAppError(validated.error))

    const { data, error } = await client
      .from('organizations')
      .insert(validated.data)
      .select()
      .single()

    if (error) return err(toAppError(error))

    const parsed = OrganizationSchema.safeParse(data)
    if (!parsed.success) return err(toAppError(parsed.error))

    return ok(parsed.data)
  } catch (e) {
    return err(toAppError(e))
  }
}

export async function updateOrganization(
  client: SupabaseClient,
  id: string,
  input: OrganizationUpdate
): Promise<Result<Organization>> {
  try {
    const validated = OrganizationUpdateSchema.safeParse(input)
    if (!validated.success) return err(toAppError(validated.error))

    const { data, error } = await client
      .from('organizations')
      .update(validated.data)
      .eq('id', id)
      .select()
      .single()

    if (error) return err(toAppError(error))

    const parsed = OrganizationSchema.safeParse(data)
    if (!parsed.success) return err(toAppError(parsed.error))

    return ok(parsed.data)
  } catch (e) {
    return err(toAppError(e))
  }
}
