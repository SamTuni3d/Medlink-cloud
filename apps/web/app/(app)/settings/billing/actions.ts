'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/auth/requireRole'
import { getSubscription } from '@medlink/data-client'
import type { Subscription } from '@medlink/data-client'

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } }

const PAYSTACK_PLAN_CODES: Record<'starter' | 'pro', string> = {
  // Replace with actual codes after creating plans at dashboard.paystack.com → Products → Plans.
  starter: process.env.PAYSTACK_STARTER_PLAN_CODE ?? 'PLN_starter',
  pro:     process.env.PAYSTACK_PRO_PLAN_CODE     ?? 'PLN_pro',
}

async function resolveOrgId(client: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await client
    .from('users')
    .select('organization_id')
    .eq('id', userId)
    .maybeSingle()
  return (data as { organization_id: string } | null)?.organization_id ?? null
}

export async function getBillingAction(): Promise<ActionResult<Subscription>> {
  const client = await createClient()
  const auth   = await requireAuth(client)
  if (!auth.ok) return { ok: false, error: auth.error }

  const orgId = await resolveOrgId(client, auth.userId)
  if (!orgId) return { ok: false, error: { code: 'NOT_FOUND', message: 'Organization not found' } }

  const result = await getSubscription(client, orgId)
  if (!result.ok) return { ok: false, error: result.error }

  return { ok: true, data: result.data }
}

export async function initiateUpgradeAction(
  plan: 'starter' | 'pro',
): Promise<ActionResult<{ authorizationUrl: string }>> {
  const client = await createClient()
  const auth   = await requireAuth(client)
  if (!auth.ok) return { ok: false, error: auth.error }

  const orgId = await resolveOrgId(client, auth.userId)
  if (!orgId) return { ok: false, error: { code: 'NOT_FOUND', message: 'Organization not found' } }

  const { data: userData, error: userErr } = await client
    .from('users')
    .select('email, full_name')
    .eq('id', auth.userId)
    .single()

  if (userErr || !userData) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'User not found' } }
  }

  const paystackKey = process.env.PAYSTACK_SECRET_KEY
  if (!paystackKey) {
    return { ok: false, error: { code: 'DB_ERROR', message: 'Payment provider not configured' } }
  }

  const resp = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${paystackKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: (userData as { email: string }).email,
      plan: PAYSTACK_PLAN_CODES[plan],
      amount: 0,
      metadata: {
        organization_id: orgId,
        plan,
        custom_fields: [
          { display_name: 'Organization', variable_name: 'organization_id', value: orgId },
        ],
      },
      callback_url: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/settings/billing?upgraded=1`,
    }),
  })

  if (!resp.ok) {
    console.error('[billing] Paystack init failed:', await resp.text())
    return { ok: false, error: { code: 'DB_ERROR', message: 'Failed to initialize payment' } }
  }

  const json = (await resp.json()) as { data?: { authorization_url?: string } }
  const authorizationUrl = json.data?.authorization_url

  if (!authorizationUrl) {
    return { ok: false, error: { code: 'DB_ERROR', message: 'No authorization URL returned' } }
  }

  revalidatePath('/settings/billing')
  return { ok: true, data: { authorizationUrl } }
}
