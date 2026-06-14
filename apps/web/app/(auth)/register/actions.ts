'use server'

import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  createOrganization,
  createUserRecord,
  getRoleIdByName,
  assignUserRole,
} from '@medlink/data-client'

export async function registerOrganization(formData: FormData) {
  const organizationName = formData.get('organizationName') as string
  const fullName = formData.get('fullName') as string
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Server configuration error' }
  }

  // 1. Create the auth user (unconfirmed — verification email sent by Supabase)
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: false,
    user_metadata: { full_name: fullName },
  })

  if (authError || !authData.user) {
    return { error: authError?.message ?? 'Failed to create account' }
  }

  const authUserId = authData.user.id

  // 2. Create the organization row
  const orgResult = await createOrganization(admin, {
    name: organizationName,
    country: 'GH',
    currency_code: 'GHS',
  })

  if (!orgResult.ok) {
    await admin.auth.admin.deleteUser(authUserId)
    return { error: orgResult.error.message }
  }

  const org = orgResult.data

  // 3. Create the public.users row (links auth.users.id → org)
  const userResult = await createUserRecord(admin, {
    id: authUserId,
    organization_id: org.id,
    full_name: fullName,
    email,
  })

  if (!userResult.ok) {
    await admin.auth.admin.deleteUser(authUserId)
    return { error: userResult.error.message }
  }

  // 4. Resolve the org_admin role UUID and assign it
  const roleResult = await getRoleIdByName(admin, 'org_admin')
  if (!roleResult.ok) {
    await admin.auth.admin.deleteUser(authUserId)
    return { error: 'Role configuration error — contact support' }
  }

  const assignResult = await assignUserRole(admin, {
    user_id: authUserId,
    organization_id: org.id,
    role_id: roleResult.data,
    branch_id: null,
    granted_by: authUserId,
  })

  if (!assignResult.ok) {
    await admin.auth.admin.deleteUser(authUserId)
    return { error: assignResult.error.message }
  }

  // 5. Embed org_id and roles in user_metadata so useAuth() can read them instantly
  await admin.auth.admin.updateUserById(authUserId, {
    user_metadata: {
      full_name: fullName,
      organization_id: org.id,
      roles: ['org_admin'],
    },
  })

  redirect('/verify-email')
}
