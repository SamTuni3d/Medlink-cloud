import type { NextConfig } from 'next'
import withPWAInit from '@ducanh2912/next-pwa'

const withPWA = withPWAInit({
  dest: 'public',
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === 'development',
  workboxOptions: {
    disableDevLogs: true,
  },
})

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host
  : '*.supabase.co'

const securityHeaders = [
  // Force HTTPS for 2 years; include subdomains
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  // Prevent the page from being embedded in an iframe (clickjacking)
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN',
  },
  // Stop browsers guessing MIME types
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  // Don't leak the full URL in the Referer header when leaving the site
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  // Disable unused browser features
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=()',
  },
  // Content Security Policy
  // 'unsafe-inline' and 'unsafe-eval' are required by Next.js App Router + Tailwind
  {
    key: 'Content-Security-Policy',
    value: [
      `default-src 'self'`,
      // Next.js inline scripts + PWA service worker
      `script-src 'self' 'unsafe-inline' 'unsafe-eval'`,
      // Tailwind / shadcn inline styles
      `style-src 'self' 'unsafe-inline'`,
      // Images: self, data URIs (logo/icons), blob (barcode scanner)
      `img-src 'self' data: blob:`,
      `font-src 'self'`,
      // Supabase REST + Realtime websocket
      `connect-src 'self' https://${supabaseHost} wss://${supabaseHost} https://*.supabase.co wss://*.supabase.co`,
      // Service worker scope
      `worker-src 'self' blob:`,
      `frame-ancestors 'none'`,
    ].join('; '),
  },
]

const nextConfig: NextConfig = {
  transpilePackages: ['@medlink/data-client', '@medlink/business-rules'],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

export default withPWA(nextConfig)
