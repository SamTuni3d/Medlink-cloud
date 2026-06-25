'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } }

// ── Branch ────────────────────────────────────────────────────────────────────

const CreateBranchSchema = z.object({
  organizationId: z.string().uuid(),
  name:           z.string().min(1, 'Branch name is required'),
  address:        z.string().nullable().optional(),
})

export async function createBranchAction(
  input: z.infer<typeof CreateBranchSchema>
): Promise<ActionResult<{ id: string; name: string; address: string | null; is_active: boolean; organization_id: string; phone: string | null; created_at: string }>> {
  const parsed = CreateBranchSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input.' } }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('branches')
    .insert({
      organization_id: parsed.data.organizationId,
      name:            parsed.data.name,
      address:         parsed.data.address ?? null,
    })
    .select('id, name, address, is_active, organization_id, phone, created_at')
    .single()

  if (error) return { ok: false, error: { code: 'DB_ERROR', message: error.message } }

  revalidatePath('/settings')
  return { ok: true, data: data as { id: string; name: string; address: string | null; is_active: boolean; organization_id: string; phone: string | null; created_at: string } }
}

const UpdateBranchSchema = z.object({
  branchId: z.string().uuid(),
  name:     z.string().min(1, 'Branch name is required'),
})

export async function updateBranchAction(
  input: z.infer<typeof UpdateBranchSchema>
): Promise<ActionResult<{ id: string; name: string; address: string | null; is_active: boolean; organization_id: string; phone: string | null; created_at: string }>> {
  const parsed = UpdateBranchSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input.' } }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('branches')
    .update({ name: parsed.data.name })
    .eq('id', parsed.data.branchId)
    .select('id, name, address, is_active, organization_id, phone, created_at')
    .single()

  if (error) return { ok: false, error: { code: 'DB_ERROR', message: error.message } }

  revalidatePath('/settings')
  return { ok: true, data: data as { id: string; name: string; address: string | null; is_active: boolean; organization_id: string; phone: string | null; created_at: string } }
}

// ── Organization ──────────────────────────────────────────────────────────────

const UpdateOrgSchema = z.object({
  organizationId:      z.string().uuid(),
  name:                z.string().min(1, 'Organization name is required'),
  city:                z.string().nullable().optional(),
  registration_number: z.string().nullable().optional(),
})

export async function updateOrganizationAction(
  input: z.infer<typeof UpdateOrgSchema>
): Promise<ActionResult> {
  const parsed = UpdateOrgSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input.' } }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('organizations')
    .update({
      name:                parsed.data.name,
      city:                parsed.data.city ?? null,
      registration_number: parsed.data.registration_number ?? null,
    })
    .eq('id', parsed.data.organizationId)

  if (error) return { ok: false, error: { code: 'DB_ERROR', message: error.message } }

  revalidatePath('/settings')
  return { ok: true, data: undefined }
}

// ── User profile ──────────────────────────────────────────────────────────────

const UpdateProfileSchema = z.object({
  userId:    z.string().uuid(),
  fullName:  z.string().min(1, 'Name is required'),
  phone:     z.string().nullable().optional(),
})

export async function updateUserProfileAction(
  input: z.infer<typeof UpdateProfileSchema>
): Promise<ActionResult> {
  const parsed = UpdateProfileSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input.' } }
  }

  const supabase = await createClient()

  // Update the users table
  const { error: dbErr } = await supabase
    .from('users')
    .update({ full_name: parsed.data.fullName, phone: parsed.data.phone ?? null })
    .eq('id', parsed.data.userId)

  if (dbErr) return { ok: false, error: { code: 'DB_ERROR', message: dbErr.message } }

  // Also update auth metadata so the name shows in the topbar immediately
  await supabase.auth.updateUser({ data: { full_name: parsed.data.fullName } })

  return { ok: true, data: undefined }
}
