// Edge Function: expiry-digest
// Called by pg_cron (via net.http_post) once per day after fn_detect_expiring_batches runs.
// Aggregates today's critical/high expiry notifications per org and sends an email
// digest to all org_admin users via Resend.
//
// POST /functions/v1/expiry-digest
// Body: {} (no body required — reads today's notifications from the DB)
// Auth: service-role key in the Authorization header (set in pg_cron call)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface OrgDigest {
  organization_id: string
  org_name: string
  admin_emails: string[]
  critical: NotifRow[]
  high: NotifRow[]
}

interface NotifRow {
  id: string
  title: string
  body: string
  branch_id: string | null
  created_at: string
  metadata: Record<string, unknown>
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceKey)

  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  if (!resendApiKey) {
    console.warn('RESEND_API_KEY not set — digest will be logged only')
  }

  // Fetch today's expiry_warning notifications (critical + high)
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const { data: notifications, error: notifErr } = await admin
    .from('notifications')
    .select('id, organization_id, branch_id, title, body, severity, metadata, created_at')
    .eq('type', 'expiry_warning')
    .in('severity', ['critical', 'warning'])
    .gte('created_at', todayStart.toISOString())

  if (notifErr) {
    console.error('Failed to fetch notifications:', notifErr.message)
    return new Response(JSON.stringify({ error: notifErr.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!notifications || notifications.length === 0) {
    return new Response(JSON.stringify({ sent: 0, reason: 'no notifications today' }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    })
  }

  // Group by organization
  const orgIds = [...new Set(notifications.map((n: { organization_id: string }) => n.organization_id))]

  // Fetch org names and admin emails in parallel
  const [orgsResult, usersResult] = await Promise.all([
    admin.from('organizations').select('id, name').in('id', orgIds),
    admin
      .from('users')
      .select('id, organization_id, email, full_name')
      .in('organization_id', orgIds)
      .eq('is_active', true)
      .in('id',
        // sub-select users who have org_admin role
        admin
          .from('user_roles')
          .select('user_id')
          .in('organization_id', orgIds)
          .eq('branch_id', null) // org-wide roles have null branch_id
      ),
  ])

  const orgMap = new Map<string, string>()
  for (const o of orgsResult.data ?? []) {
    orgMap.set((o as { id: string; name: string }).id, (o as { id: string; name: string }).name)
  }

  // Build org → admin emails map
  const adminEmailsByOrg = new Map<string, string[]>()
  for (const u of usersResult.data ?? []) {
    const row = u as { organization_id: string; email: string }
    const emails = adminEmailsByOrg.get(row.organization_id) ?? []
    emails.push(row.email)
    adminEmailsByOrg.set(row.organization_id, emails)
  }

  const digests: OrgDigest[] = orgIds.map(orgId => {
    const orgNotifs = notifications.filter(
      (n: { organization_id: string }) => n.organization_id === orgId
    ) as (NotifRow & { severity: string })[]

    return {
      organization_id: orgId,
      org_name: orgMap.get(orgId) ?? orgId,
      admin_emails: adminEmailsByOrg.get(orgId) ?? [],
      critical: orgNotifs.filter(n => n.severity === 'critical'),
      high: orgNotifs.filter(n => n.severity === 'warning'),
    }
  })

  let sent = 0
  for (const digest of digests) {
    if (digest.admin_emails.length === 0) continue

    const totalCount = digest.critical.length + digest.high.length
    const subject = `[MedLink] ${totalCount} expiry alert${totalCount !== 1 ? 's' : ''} — ${digest.org_name}`

    const bodyLines: string[] = [
      `Hello,`,
      ``,
      `The following medications require your attention today:`,
      ``,
    ]

    if (digest.critical.length > 0) {
      bodyLines.push(`🔴 CRITICAL (expires within 30 days):`)
      for (const n of digest.critical) {
        bodyLines.push(`  • ${n.body}`)
      }
      bodyLines.push(``)
    }

    if (digest.high.length > 0) {
      bodyLines.push(`🟡 HIGH RISK (expires within 60 days):`)
      for (const n of digest.high) {
        bodyLines.push(`  • ${n.body}`)
      }
      bodyLines.push(``)
    }

    bodyLines.push(`Log in to MedLink Cloud to review and take action.`)

    const emailBody = bodyLines.join('\n')
    console.log(`Digest for ${digest.org_name}:\n${emailBody}`)

    if (resendApiKey) {
      const emailResp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'MedLink Cloud <noreply@medlinkcloud.app>',
          to: digest.admin_emails,
          subject,
          text: emailBody,
        }),
      })

      if (!emailResp.ok) {
        console.error(`Failed to send digest to ${digest.admin_emails.join(', ')}: ${await emailResp.text()}`)
      } else {
        sent++
      }
    }
  }

  return new Response(JSON.stringify({ sent, digests: digests.length }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
