import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, {
                ...options,
                httpOnly: true,
                secure:   process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                // Supabase renews the session before expiry; 7 days is the outer bound
                maxAge:   options?.maxAge ?? 60 * 60 * 24 * 7,
              })
            )
          } catch {
            // Called from a Server Component — cookie mutation is a no-op here.
            // Middleware handles token refresh instead.
          }
        },
      },
    }
  )
}
