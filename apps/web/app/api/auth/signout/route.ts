import { type NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

// GET /api/auth/signout
// Full HTTP redirect (not a soft Next.js router navigation) so the browser
// applies the Set-Cookie clearing headers BEFORE following the redirect to
// /login. This guarantees the middleware sees no session cookie.
export async function GET(request: NextRequest) {
  const supabase = await createClient()

  // Revoke all sessions for this user on Supabase's side.
  await supabase.auth.signOut({ scope: 'global' })

  // Build the redirect response first, then stamp the cleared cookies onto it.
  const response = NextResponse.redirect(new URL('/login', request.url))

  // Manually expire every sb-*-auth-token cookie. Supabase SSR may or may not
  // call setAll to clear them; this guarantees they are gone.
  const cookieStore = await cookies()
  for (const { name } of cookieStore.getAll()) {
    if (name.startsWith('sb-') && name.includes('-auth-token')) {
      response.cookies.set(name, '', { maxAge: 0, path: '/', sameSite: 'lax' })
    }
  }

  return response
}
