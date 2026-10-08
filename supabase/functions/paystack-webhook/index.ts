// Edge Function: paystack-webhook
// Receives webhook events from Paystack and updates subscription state.
//
// POST /functions/v1/paystack-webhook
// Paystack signs every request with HMAC-SHA512 using the secret key.
// Ref: https://paystack.com/docs/payments/webhooks/
//
// Handled events:
//   charge.success          → activate subscription / extend period
//   subscription.create     → store paystack_subscription_code
//   subscription.disable    → mark cancelled
//   subscription.expiry_card → mark past_due
//   invoice.payment_failed  → mark past_due

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createHmac } from 'https://deno.land/std@0.177.0/node/crypto.ts'

const PLAN_LIMITS: Record<string, { max_branches: number; max_users: number }> = {
  free:    { max_branches: 1,  max_users: 5  },
  starter: { max_branches: 1,  max_users: 5  },
  pro:     { max_branches: 3,  max_users: 15 },
}

function planFromPaystackCode(planCode: string | undefined): 'starter' | 'pro' | 'free' {
  if (!planCode) return 'free'
  if (planCode.toLowerCase().includes('pro'))     return 'pro'
  if (planCode.toLowerCase().includes('starter')) return 'starter'
  return 'free'
}

async function verifySignature(req: Request, secret: string): Promise<string | null> {
  const sig  = req.headers.get('x-paystack-signature')
  const body = await req.text()
  if (!sig) return null
  const hash = createHmac('sha512', secret).update(body).digest('hex')
  return hash === sig ? body : null
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const secret = Deno.env.get('PAYSTACK_SECRET_KEY')
  if (!secret) {
    console.error('[paystack-webhook] PAYSTACK_SECRET_KEY not configured')
    return new Response('Server misconfiguration', { status: 500 })
  }

  const rawBody = await verifySignature(req, secret)
  if (!rawBody) {
    return new Response('Invalid signature', { status: 401 })
  }

  let event: Record<string, unknown>
  try {
    event = JSON.parse(rawBody) as Record<string, unknown>
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  const eventType   = event['event']   as string
  const data        = event['data']    as Record<string, unknown> | undefined
  const paystackRef = (data?.['reference'] ?? data?.['id'] ?? eventType + '_' + Date.now()) as string

  // Determine org from Paystack customer email
  const customerEmail = (
    (data?.['customer'] as Record<string, unknown> | undefined)?.['email'] ??
    (data?.['authorization'] as Record<string, unknown> | undefined)?.['email']
  ) as string | undefined

  let orgId: string | undefined
  if (customerEmail) {
    const { data: user } = await admin
      .from('users')
      .select('organization_id')
      .eq('email', customerEmail)
      .maybeSingle()
    orgId = (user as { organization_id: string } | null)?.organization_id
  }

  // Idempotency check
  const { data: existing } = await admin
    .from('billing_events')
    .select('id')
    .eq('paystack_event_id', paystackRef)
    .maybeSingle()

  if (existing) {
    return new Response(JSON.stringify({ ok: true, reason: 'already processed' }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    })
  }

  // Log the event
  await admin.from('billing_events').insert({
    organization_id: orgId ?? null,
    paystack_event_id: paystackRef,
    event_type: eventType,
    payload: event,
  })

  if (!orgId) {
    console.warn(`[paystack-webhook] Could not resolve org for event ${eventType} / ${paystackRef}`)
    return new Response(JSON.stringify({ ok: true, reason: 'org not found — event logged' }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    })
  }

  // Apply subscription state changes
  const planCode      = (data?.['plan']             as Record<string, unknown> | undefined)?.['plan_code'] as string | undefined
  const subCode       = data?.['subscription_code'] as string | undefined
  const customerCode  = (data?.['customer'] as Record<string, unknown> | undefined)?.['customer_code'] as string | undefined

  let patch: Record<string, unknown> | undefined

  switch (eventType) {
    case 'charge.success': {
      const plan   = planFromPaystackCode(planCode)
      const limits = PLAN_LIMITS[plan]
      const paidAt = new Date((data?.['paid_at'] as string | undefined) ?? Date.now())
      patch = {
        plan,
        status: 'active',
        current_period_start: paidAt.toISOString(),
        current_period_end: new Date(paidAt.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        paystack_customer_id: customerCode,
        paystack_plan_code: planCode ?? null,
        ...limits,
      }
      break
    }
    case 'subscription.create': {
      const plan   = planFromPaystackCode(planCode)
      const limits = PLAN_LIMITS[plan]
      patch = {
        plan,
        status: 'active',
        paystack_subscription_code: subCode ?? null,
        paystack_customer_id: customerCode ?? null,
        paystack_plan_code: planCode ?? null,
        ...limits,
      }
      break
    }
    case 'subscription.disable':
      patch = { status: 'cancelled' }
      break
    case 'subscription.expiry_card':
    case 'invoice.payment_failed':
      patch = { status: 'past_due' }
      break
    default:
      console.log(`[paystack-webhook] Unhandled event type: ${eventType}`)
  }

  if (patch) {
    const { error } = await admin
      .from('subscriptions')
      .update(patch)
      .eq('organization_id', orgId)

    if (error) {
      console.error(`[paystack-webhook] Failed to update subscription for org ${orgId}:`, error.message)
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  })
})
