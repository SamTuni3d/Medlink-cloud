// Edge Function: send-alert
// Fire-and-forget dispatcher for SMS (Arkesel) and email (Resend) notifications.
//
// POST /functions/v1/send-alert
// Auth: service-role key in Authorization header
//
// Body:
// {
//   type: 'low_stock' | 'prescription_ready' | 'expiry_warning' | 'custom',
//   sms?: { to: string[]; message: string },   // E.164 numbers, e.g. "+233XXXXXXXX"
//   email?: { to: string[]; subject: string; text: string },
//   audit_ref?: { organization_id: string; branch_id?: string; metadata?: Record<string, unknown> }
// }
//
// Always returns 200. Failures are logged to audit_logs — they must NEVER block callers.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface SmsPayload  { to: string[]; message: string }
interface EmailPayload { to: string[]; subject: string; text: string }
interface AuditRef {
  organization_id: string
  branch_id?: string
  metadata?: Record<string, unknown>
}

interface AlertBody {
  type: string
  sms?: SmsPayload
  email?: EmailPayload
  audit_ref?: AuditRef
}

interface DispatchResult {
  ok: boolean
  provider: 'arkesel' | 'resend'
  detail?: string
}

async function sendSms(numbers: string[], message: string, apiKey: string): Promise<DispatchResult> {
  try {
    const resp = await fetch('https://sms.arkesel.com/api/v2/sms/send', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: 'MedLink',
        message,
        recipients: numbers,
      }),
    })

    if (!resp.ok) {
      const body = await resp.text()
      return { ok: false, provider: 'arkesel', detail: body }
    }
    return { ok: true, provider: 'arkesel' }
  } catch (err) {
    return { ok: false, provider: 'arkesel', detail: String(err) }
  }
}

async function sendEmail(
  to: string[],
  subject: string,
  text: string,
  apiKey: string,
): Promise<DispatchResult> {
  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'MedLink Cloud <noreply@medlinkcloud.app>',
        to,
        subject,
        text,
      }),
    })

    if (!resp.ok) {
      const body = await resp.text()
      return { ok: false, provider: 'resend', detail: body }
    }
    return { ok: true, provider: 'resend' }
  } catch (err) {
    return { ok: false, provider: 'resend', detail: String(err) }
  }
}

async function logFailure(
  admin: ReturnType<typeof createClient>,
  auditRef: AuditRef | undefined,
  results: DispatchResult[],
  type: string,
): Promise<void> {
  const failures = results.filter(r => !r.ok)
  if (failures.length === 0 || !auditRef) return

  try {
    await admin.from('audit_logs').insert({
      organization_id: auditRef.organization_id,
      branch_id: auditRef.branch_id ?? null,
      action: 'notification_dispatch_failed',
      details: {
        alert_type: type,
        failures: failures.map(f => ({ provider: f.provider, detail: f.detail })),
        ...(auditRef.metadata ?? {}),
      },
    })
  } catch (err) {
    // Audit log failure is non-fatal — just emit to function logs
    console.error('Could not write audit log:', err)
  }
}

Deno.serve(async (req: Request) => {
  // Always return 200 — callers must not be blocked
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, reason: 'method not allowed' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let body: AlertBody
  try {
    body = await req.json() as AlertBody
  } catch {
    return new Response(JSON.stringify({ ok: false, reason: 'invalid json' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const arkeselKey = Deno.env.get('ARKESEL_API_KEY')
  const resendKey  = Deno.env.get('RESEND_API_KEY')

  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  const results: DispatchResult[] = []

  // Dispatch SMS
  if (body.sms && body.sms.to.length > 0) {
    if (arkeselKey) {
      const r = await sendSms(body.sms.to, body.sms.message, arkeselKey)
      results.push(r)
      if (!r.ok) console.error(`[send-alert] SMS failed (${body.type}):`, r.detail)
    } else {
      console.warn('[send-alert] ARKESEL_API_KEY not set — SMS skipped')
    }
  }

  // Dispatch email
  if (body.email && body.email.to.length > 0) {
    if (resendKey) {
      const r = await sendEmail(body.email.to, body.email.subject, body.email.text, resendKey)
      results.push(r)
      if (!r.ok) console.error(`[send-alert] Email failed (${body.type}):`, r.detail)
    } else {
      console.warn('[send-alert] RESEND_API_KEY not set — email skipped')
    }
  }

  // Log failures to audit_logs (fire-and-forget, never throws)
  await logFailure(admin, body.audit_ref, results, body.type)

  const allOk = results.every(r => r.ok)
  return new Response(
    JSON.stringify({ ok: allOk, dispatched: results.length, results }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
})
