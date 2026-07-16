'use server'

import { headers } from 'next/headers'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'

const ForgotSchema = z.object({
  email: z.string().email().max(254).toLowerCase().trim(),
})

// Allowlist of origins that may appear in the Host header.
// NEXT_PUBLIC_SITE_URL should be set to your production domain (e.g. https://app.medlink.cloud).
// In development it defaults to localhost.
function getAllowedOrigin(requestOrigin: string): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ''
  const allowed = [
    siteUrl,
    'http://localhost:3000',
    'https://localhost:3000',
  ].filter(Boolean)

  // Exact origin comparison — startsWith would allow https://app.medlink.cloud.evil.com to pass
  if (allowed.some(o => requestOrigin === o)) {
    return requestOrigin
  }

  // Fall back to the configured site URL to prevent open-redirect via a forged Origin header
  return siteUrl || 'http://localhost:3000'
}

export async function requestPasswordReset(formData: FormData) {
  const headersList = await headers()
  const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

  if (!checkRateLimit(`forgot:${ip}`, 5)) {
    // Return success regardless — never confirm whether a rate limit was hit
    // (would allow attackers to probe for valid IPs)
    return { success: true }
  }

  const parsed = ForgotSchema.safeParse({ email: formData.get('email') })
  if (!parsed.success) {
    // Don't reveal validation details — always appear successful to prevent email enumeration
    return { success: true }
  }

  const rawOrigin = headersList.get('origin') ?? ''
  const safeOrigin = getAllowedOrigin(rawOrigin)

  const supabase = await createClient()
  // Fire-and-forget — we always return success whether or not the email exists
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${safeOrigin}/api/auth/callback?next=/reset-password`,
  })

  return { success: true }
}
