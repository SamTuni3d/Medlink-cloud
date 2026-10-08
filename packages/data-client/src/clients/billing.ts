import type { SupabaseClient } from '@supabase/supabase-js'
import { ok, err, type Result } from '../lib/result'
import { toAppError } from '../lib/errors'
import { z } from 'zod'

export const SubscriptionSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  plan: z.enum(['free', 'starter', 'pro']),
  status: z.enum(['trialing', 'active', 'past_due', 'cancelled', 'expired']),
  trial_ends_at: z.string(),
  current_period_start: z.string().nullable(),
  current_period_end: z.string().nullable(),
  paystack_customer_id: z.string().nullable(),
  paystack_subscription_code: z.string().nullable(),
  paystack_plan_code: z.string().nullable(),
  max_branches: z.number().int(),
  max_users: z.number().int(),
  created_at: z.string(),
  updated_at: z.string(),
})

export type Subscription = z.infer<typeof SubscriptionSchema>

export const PLAN_DISPLAY: Record<Subscription['plan'], { name: string; price: string; currency: string }> = {
  free:    { name: 'Free',    price: '0',   currency: 'GHS' },
  starter: { name: 'Starter', price: '150', currency: 'GHS' },
  pro:     { name: 'Pro',     price: '350', currency: 'GHS' },
}

export async function getSubscription(
  client: SupabaseClient,
  organizationId: string,
): Promise<Result<Subscription>> {
  try {
    const { data, error } = await client
      .from('subscriptions')
      .select(
        'id, organization_id, plan, status, trial_ends_at, current_period_start, ' +
        'current_period_end, paystack_customer_id, paystack_subscription_code, ' +
        'paystack_plan_code, max_branches, max_users, created_at, updated_at',
      )
      .eq('organization_id', organizationId)
      .maybeSingle()

    if (error) return err(toAppError(error))
    if (!data)  return err({ code: 'NOT_FOUND', message: 'Subscription not found' })

    const parsed = SubscriptionSchema.safeParse(data)
    if (!parsed.success) return err(toAppError(parsed.error))

    return ok(parsed.data)
  } catch (e) {
    return err(toAppError(e))
  }
}

export function isSubscriptionActive(sub: Subscription): boolean {
  if (sub.status === 'active') return true
  if (sub.status === 'trialing') {
    return new Date(sub.trial_ends_at) > new Date()
  }
  return false
}

export function hasReachedBranchLimit(sub: Subscription, currentBranchCount: number): boolean {
  return currentBranchCount >= sub.max_branches
}

export function hasReachedUserLimit(sub: Subscription, currentUserCount: number): boolean {
  return currentUserCount >= sub.max_users
}
