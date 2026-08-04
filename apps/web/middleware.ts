import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// Node.js runtime avoids the MIDDLEWARE_INVOCATION_FAILED error that
// @supabase/ssr triggers on Vercel's Edge runtime.
export const runtime = 'nodejs'

const AUTH_ROUTES = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // API routes are self-gating. /api/auth/signout must run without being
  // intercepted; /api/auth/callback must run to exchange codes for cookies.
  if (pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  const isAuthRoute = AUTH_ROUTES.some((r) => pathname.startsWith(r))

  // Build a response we can attach refreshed cookies to.
  let response = NextResponse.next({ request })

  // Create a Supabase client wired to read/write cookies on this request/response.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Write onto the request so downstream code sees fresh cookies.
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          // Re-create response so it carries the updated request headers.
          response = NextResponse.next({ request })
          // Write onto the response so the browser receives updated cookies.
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, {
              ...options,
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
              path: '/',
            })
          )
        },
      },
    }
  )

  // getUser() validates the access token and silently refreshes it when it
  // has expired — the new tokens are written via setAll above.
  const { data: { user } } = await supabase.auth.getUser()

  const isAuthenticated = !!user

  if (!isAuthenticated && !isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (isAuthenticated && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|icons|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
