import { createClient } from '@supabase/supabase-js'

// Service-role client — server-side only. Never import this in client components.
// Used exclusively for privileged operations: registration, user management.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key || url.includes('placeholder') || key.includes('placeholder')) {
    throw new Error(
      'Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY to apps/web/.env.local'
    )
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
