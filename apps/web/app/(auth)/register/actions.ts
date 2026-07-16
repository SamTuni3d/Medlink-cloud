'use server'

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'
import {
  createOrganization,
  createBranch,
  createUserRecord,
  getRoleIdByName,
  assignUserRole,
} from '@medlink/data-client'

const RegisterSchema = z.object({
  organizationName: z.string().min(2).max(120).trim(),
  fullName:         z.string().min(2).max(120).trim(),
  email:            z.string().email().max(254).toLowerCase().trim(),
  password:         z.string().min(8).max(512),
})

export async function registerOrganization(formData: FormData) {
  const headersList = await headers()
  const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

  // Tighter limit for registration — 5 attempts per 15 min per IP
  if (!checkRateLimit(`register:${ip}`, 5)) {
    return { error: 'Too many registration attempts. Please wait and try again.' }
  }

  const parsed = RegisterSchema.safeParse({
    organizationName: formData.get('organizationName'),
    fullName:         formData.get('fullName'),
    email:            formData.get('email'),
    password:         formData.get('password'),
  })
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { error: first?.message ?? 'Invalid registration details.' }
  }

  const { organizationName, fullName, email, password } = parsed.data

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch {
    return { error: 'Server configuration error. Please contact support.' }
  }

  // 1. Create auth user (auto-confirm for beta; add email verification when ready)
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })

  if (authError || !authData.user) {
    // Map common Supabase errors to safe client messages
    const msg = authError?.message?.toLowerCase() ?? ''
    if (msg.includes('already registered') || msg.includes('already exists') || msg.includes('duplicate')) {
      return { error: 'An account with this email already exists.' }
    }
    return { error: 'Failed to create account. Please try again.' }
  }

  const authUserId = authData.user.id

  // 2. Create organization
  const orgResult = await createOrganization(admin, {
    name: organizationName,
    country: 'GH',
    currency_code: 'GHS',
  })
  if (!orgResult.ok) {
    await admin.auth.admin.deleteUser(authUserId)
    return { error: 'Failed to set up your organization. Please try again.' }
  }
  const org = orgResult.data

  // 3. Create default main branch
  const branchResult = await createBranch(admin, {
    organization_id: org.id,
    name: `${organizationName} — Main Branch`,
  })
  if (!branchResult.ok) {
    await admin.auth.admin.deleteUser(authUserId)
    return { error: 'Failed to set up your branch. Please try again.' }
  }

  // 4. Create public.users row
  const userResult = await createUserRecord(admin, {
    id:              authUserId,
    organization_id: org.id,
    full_name:       fullName,
    email,
  })
  if (!userResult.ok) {
    await admin.auth.admin.deleteUser(authUserId)
    return { error: 'Failed to set up your profile. Please try again.' }
  }

  // 5. Assign org_admin role
  const roleResult = await getRoleIdByName(admin, 'org_admin')
  if (!roleResult.ok) {
    await admin.auth.admin.deleteUser(authUserId)
    return { error: 'Role configuration error. Please contact support.' }
  }

  const assignResult = await assignUserRole(admin, {
    user_id:         authUserId,
    organization_id: org.id,
    role_id:         roleResult.data,
    branch_id:       null,
    granted_by:      authUserId,
  })
  if (!assignResult.ok) {
    await admin.auth.admin.deleteUser(authUserId)
    return { error: 'Failed to assign permissions. Please try again.' }
  }

  // 6. Embed org_id + role in app_metadata (admin-only writable — users cannot forge this).
  //    useAuth() reads app_metadata on the fast path; user_metadata is user-writable so we
  //    never store authorization claims there.
  await admin.auth.admin.updateUserById(authUserId, {
    app_metadata: {
      organization_id: org.id,
      roles:           ['org_admin'],
    },
    user_metadata: {
      full_name: fullName,
    },
  })

  // 7. Auto sign-in
  const serverClient = await createClient()
  await serverClient.auth.signInWithPassword({ email, password })

  redirect('/onboarding')
}
