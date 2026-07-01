import { NextResponse, type NextRequest } from 'next/server'

// Auth check is done by inspecting the Supabase session cookie directly.
// This avoids calling @supabase/ssr in the Edge runtime which can cause
// MIDDLEWARE_INVOCATION_FAILED on Vercel. Full session validation happens
// inside each Server Component / Route Handler via createServerClient.
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const authRoutes = [
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password',
    '/verify-email',
  ]
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route))

  // API routes handle their own auth — never gate them here.
  // This is critical for /api/auth/callback which must run without a session
  // to exchange the password-reset / email-confirm code for a cookie.
  if (pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // Supabase stores the session in a cookie named sb-<ref>-auth-token
  const hasSession = request.cookies.getAll().some(
    (c) => c.name.startsWith('sb-') && c.name.includes('-auth-token')
  )

  if (!hasSession && !isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (hasSession && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|icons|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
