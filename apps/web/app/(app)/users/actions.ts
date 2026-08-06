'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { createUserRecord, getRoleIdByName, assignUserRole, getBranches } from '@medlink/data-client'
import type { Branch } from '@medlink/data-client'

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } }

const BRANCH_SCOPED_ROLES = new Set([
  'branch_manager', 'pharmacist', 'cashier', 'inventory_manager', 'auditor',
])

const INVITE_ROLES = ['org_admin', 'super_admin']
const INVITE_RATE_LIMIT = 10 // max invitations per org per hour

const InviteStaffSchema = z.object({
  fullName:       z.string().min(1, 'Full name is required'),
  email:          z.string().email('Invalid email address'),
  role:           z.enum(['org_admin', 'branch_manager', 'pharmacist', 'cashier', 'inventory_manager', 'auditor', 'super_admin']),
  branchId:       z.string().uuid().nullable(),
  organizationId: z.string().uuid(),
})

export async function inviteStaffAction(
  input: z.infer<typeof InviteStaffSchema>
): Promise<ActionResult> {
  const parsed = InviteStaffSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input.' } }
  }

  const { fullName, email, role, branchId, organizationId } = parsed.data

  // Derive the caller from the server-side session — never trust client-supplied identity
  const supabase = await createClient()
  const { data: { user: caller }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !caller) {
    return { ok: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated.' } }
  }

  // Only org_admin and super_admin may invite users
  const { data: callerRoles } = await supabase
    .from('user_roles')
    .select('roles(name)')
    .eq('user_id', caller.id)
  const callerRoleNames = ((callerRoles ?? []) as { roles: { name: string } | { name: string }[] | null }[])
    .flatMap(r => {
      if (!r.roles) return []
      return Array.isArray(r.roles) ? r.roles.map(x => x.name) : [r.roles.name]
    })
  if (!INVITE_ROLES.some(r => callerRoleNames.includes(r))) {
    return { ok: false, error: { code: 'UNAUTHORIZED', message: 'Only org admins can invite staff.' } }
  }

  // Branch-scoped roles require a branch
  const needsBranch = BRANCH_SCOPED_ROLES.has(role)
  if (needsBranch && !branchId) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Please select a branch for this role.' } }
  }

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch {
    return { ok: false, error: { code: 'UNKNOWN_ERROR', message: 'Server configuration error.' } }
  }

  // Rate limit: no more than INVITE_RATE_LIMIT invitations per org in the last hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count: recentCount } = await admin
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .gte('created_at', oneHourAgo)
  if ((recentCount ?? 0) >= INVITE_RATE_LIMIT) {
    return { ok: false, error: { code: 'CONFLICT', message: 'Too many invitations sent recently. Please wait before inviting more staff.' } }
  }

  // 1. Send invitation email — Supabase delivers a magic link; user sets their password on first login
  const { data: inviteData, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName, organization_id: organizationId },
  })

  if (inviteErr || !inviteData?.user) {
    return { ok: false, error: { code: 'DB_ERROR', message: inviteErr?.message ?? 'Failed to send invitation.' } }
  }

  const newUserId = inviteData.user.id

  // 2. Create the public.users row immediately (we know their name and org)
  const userResult = await createUserRecord(admin, {
    id:              newUserId,
    organization_id: organizationId,
    full_name:       fullName,
    email,
    default_branch_id: branchId ?? null,
  })

  if (!userResult.ok) {
    await admin.auth.admin.deleteUser(newUserId)
    return { ok: false, error: userResult.error }
  }

  // 3. Resolve role UUID and assign it
  const roleResult = await getRoleIdByName(admin, role)
  if (!roleResult.ok) {
    await admin.auth.admin.deleteUser(newUserId)
    return { ok: false, error: { code: 'DB_ERROR', message: 'Role not found.' } }
  }

  const assignResult = await assignUserRole(admin, {
    user_id:         newUserId,
    organization_id: organizationId,
    role_id:         roleResult.data,
    branch_id:       needsBranch ? branchId : null,
    granted_by:      caller.id,
  })

  if (!assignResult.ok) {
    await admin.auth.admin.deleteUser(newUserId)
    return { ok: false, error: assignResult.error }
  }

  // 4. Embed role in app_metadata (admin-only writable — cannot be forged by the invited user).
  await admin.auth.admin.updateUserById(newUserId, {
    app_metadata:  { organization_id: organizationId, roles: [role] },
    user_metadata: { full_name: fullName },
  })

  revalidatePath('/users')
  return { ok: true, data: undefined }
}

export async function getBranchesAction(): Promise<ActionResult<Branch[]>> {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      return { ok: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated.' } }
    }

    // Use admin client to reliably bypass any JWT-timing RLS issues on branch reads
    let admin: ReturnType<typeof createAdminClient>
    try { admin = createAdminClient() } catch {
      return { ok: false, error: { code: 'UNKNOWN_ERROR', message: 'Server configuration error.' } }
    }

    // Resolve the user's organization from the database (authoritative source)
    const { data: userRow } = await admin.from('users').select('organization_id').eq('id', user.id).single()
    if (!userRow?.organization_id) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'User organization not found.' } }
    }

    const result = await getBranches(admin, userRow.organization_id)
    if (!result.ok) return { ok: false, error: result.error }
    return { ok: true, data: result.data }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return { ok: false, error: { code: 'UNKNOWN_ERROR', message: msg } }
  }
}
