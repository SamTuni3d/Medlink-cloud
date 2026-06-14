import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { ok, err, type Result } from '../lib/result'
import { toAppError } from '../lib/errors'
import { UserSchema, UserRoleSchema, type User, type UserRole, type RoleName } from '../schemas/users'

export interface UserWithRoles extends User {
  roles: RoleName[]
}

const UserInsertSchema = UserSchema.omit({ id: true, created_at: true, updated_at: true })
type UserInsert = z.infer<typeof UserInsertSchema>

export async function listUsers(
  client: SupabaseClient,
  organizationId: string,
  opts: { activeOnly?: boolean; branchId?: string } = {}
): Promise<Result<User[]>> {
  try {
    let query = client
      .from('users')
      .select('*')
      .eq('organization_id', organizationId)
      .order('full_name', { ascending: true })

    if (opts.activeOnly !== false) {
      query = query.eq('is_active', true)
    }
    if (opts.branchId) {
      // Filter users who have at least one role in this branch
      query = query.eq('default_branch_id', opts.branchId)
    }

    const { data, error } = await query
    if (error) return err(toAppError(error))

    const parsed = z.array(UserSchema).safeParse(data)
    if (!parsed.success) return err(toAppError(parsed.error))

    return ok(parsed.data)
  } catch (e) {
    return err(toAppError(e))
  }
}

export async function getUserById(
  client: SupabaseClient,
  id: string
): Promise<Result<User>> {
  try {
    const { data, error } = await client
      .from('users')
      .select('*')
      .eq('id', id)
      .single()

    if (error) return err(toAppError(error))

    const parsed = UserSchema.safeParse(data)
    if (!parsed.success) return err(toAppError(parsed.error))

    return ok(parsed.data)
  } catch (e) {
    return err(toAppError(e))
  }
}

/** Create a public.users row (linked to an auth.users entry already created) */
export async function createUserRecord(
  client: SupabaseClient,
  input: {
    id: string
    organization_id: string
    full_name: string
    email: string
    phone?: string | null
    default_branch_id?: string | null
  }
): Promise<Result<User>> {
  try {
    const { data, error } = await client
      .from('users')
      .insert({
        id: input.id,
        organization_id: input.organization_id,
        full_name: input.full_name,
        email: input.email,
        phone: input.phone ?? null,
        default_branch_id: input.default_branch_id ?? null,
        is_active: true,
      })
      .select()
      .single()

    if (error) return err(toAppError(error))

    const parsed = UserSchema.safeParse(data)
    if (!parsed.success) return err(toAppError(parsed.error))

    return ok(parsed.data)
  } catch (e) {
    return err(toAppError(e))
  }
}

export async function updateUser(
  client: SupabaseClient,
  id: string,
  input: { full_name?: string; phone?: string | null; is_active?: boolean; default_branch_id?: string | null }
): Promise<Result<User>> {
  try {
    const { data, error } = await client
      .from('users')
      .update(input)
      .eq('id', id)
      .select()
      .single()

    if (error) return err(toAppError(error))

    const parsed = UserSchema.safeParse(data)
    if (!parsed.success) return err(toAppError(parsed.error))

    return ok(parsed.data)
  } catch (e) {
    return err(toAppError(e))
  }
}

export async function listUsersWithRoles(
  client: SupabaseClient,
  organizationId: string
): Promise<Result<UserWithRoles[]>> {
  try {
    const { data, error } = await client
      .from('users')
      .select('*, user_roles(role_id, branch_id, roles(name))')
      .eq('organization_id', organizationId)
      .order('full_name', { ascending: true })

    if (error) return err(toAppError(error))

    const rows = (data ?? []).map((row: Record<string, unknown>) => {
      const userRoles = (row.user_roles ?? []) as { roles: { name: string } | null }[]
      const roles = userRoles
        .map(ur => ur.roles?.name)
        .filter((n): n is RoleName => Boolean(n))
      const { user_roles: _drop, ...rest } = row
      return { ...rest, roles }
    })

    const parsed = z.array(UserSchema.extend({ roles: z.array(z.string()) })).safeParse(rows)
    if (!parsed.success) return err(toAppError(parsed.error))

    return ok(parsed.data as UserWithRoles[])
  } catch (e) {
    return err(toAppError(e))
  }
}

/** Look up the UUID of a role by its name (e.g. 'org_admin') */
export async function getRoleIdByName(
  client: SupabaseClient,
  name: RoleName
): Promise<Result<string>> {
  try {
    const { data, error } = await client
      .from('roles')
      .select('id')
      .eq('name', name)
      .single()

    if (error) return err(toAppError(error))
    return ok((data as { id: string }).id)
  } catch (e) {
    return err(toAppError(e))
  }
}

/** Assign a role to a user scoped to an org (branch_id = null for org-wide) */
export async function assignUserRole(
  client: SupabaseClient,
  input: {
    user_id: string
    organization_id: string
    role_id: string
    branch_id?: string | null
    granted_by: string
  }
): Promise<Result<void>> {
  try {
    const { error } = await client.from('user_roles').insert({
      user_id: input.user_id,
      organization_id: input.organization_id,
      role_id: input.role_id,
      branch_id: input.branch_id ?? null,
      granted_by: input.granted_by,
    })

    if (error) return err(toAppError(error))
    return ok(undefined)
  } catch (e) {
    return err(toAppError(e))
  }
}

/** Returns all roles for a user, joined with role name for display */
export async function getUserRoles(
  client: SupabaseClient,
  userId: string
): Promise<Result<UserRole[]>> {
  try {
    const { data, error } = await client
      .from('user_roles')
      .select('*, roles(name)')
      .eq('user_id', userId)
      .order('granted_at', { ascending: false })

    if (error) return err(toAppError(error))

    // Flatten the nested roles join into role_name
    const flattened = (data ?? []).map((row: Record<string, unknown>) => {
      const roles = row.roles as { name: string } | null
      const { roles: _drop, ...rest } = row
      return { ...rest, role_name: roles?.name }
    })

    const parsed = z.array(UserRoleSchema).safeParse(flattened)
    if (!parsed.success) return err(toAppError(parsed.error))

    return ok(parsed.data)
  } catch (e) {
    return err(toAppError(e))
  }
}
