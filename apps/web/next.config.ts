import type { NextConfig } from 'next'
import withPWAInit from '@ducanh2912/next-pwa'

const withPWA = withPWAInit({
  dest: 'public',
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === 'development',
  fallbacks: {
    // Served by the service worker when a navigation request fails offline
    document: '/offline.html',
  },
  workboxOptions: { disableDevLogs: true },
})

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host
  : '*.supabase.co'

const securityHeaders = [
  // Force HTTPS for 2 years; include subdomains
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  // Prevent clickjacking
  { key: 'X-Frame-Options', value: 'DENY' },
  // Stop MIME-type sniffing
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Don't expose full URL in Referer when leaving the site
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Disable browser features this app doesn't use
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=()' },
  // Don't advertise the server stack
  { key: 'X-Powered-By', value: '' },
  // Opt out of FLoC / Topics API
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  // Content Security Policy
  // Note: 'unsafe-inline' + 'unsafe-eval' are required by Next.js App Router + Tailwind CSS 3.
  // 'unsafe-eval' is only strictly needed in development; the prod bundle uses function constructors
  // for webpack chunk loading which some runtimes classify as eval. Keep until Next.js ships
  // nonce-based CSP support in a stable release.
  {
    key: 'Content-Security-Policy',
    value: [
      `default-src 'self'`,
      `script-src 'self' 'unsafe-inline' 'unsafe-eval'`,
      `style-src 'self' 'unsafe-inline'`,
      // self + data URIs (inline icons/logos) + blob (barcode / canvas export)
      `img-src 'self' data: blob:`,
      `font-src 'self'`,
      // Supabase REST, Auth, Realtime websocket
      `connect-src 'self' https://${supabaseHost} wss://${supabaseHost} https://*.supabase.co wss://*.supabase.co`,
      `worker-src 'self' blob:`,
      // Prevents <base> tag hijacking
      `base-uri 'self'`,
      // No plugins (Flash, etc.)
      `object-src 'none'`,
      // Forms may only submit back to our own origin
      `form-action 'self'`,
      // No one may embed us in an iframe
      `frame-ancestors 'none'`,
      // Upgrade any stray http:// subresource requests
      `upgrade-insecure-requests`,
    ].join('; '),
  },
]

const nextConfig: NextConfig = {
  transpilePackages: ['@medlink/data-client', '@medlink/business-rules'],

  // Compress responses with gzip/brotli at the Next.js layer
  compress: true,

  // Remove X-Powered-By response header
  poweredByHeader: false,

  // Tree-shake large packages so unused icons/components are excluded from the bundle
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'recharts',
      'framer-motion',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-select',
      '@radix-ui/react-tabs',
      '@radix-ui/react-popover',
    ],
  },

  images: {
    // Prefer AVIF → WebP → original; reduces image payload by 30-60%
    formats: ['image/avif', 'image/webp'],
    // Cache optimised images for 60 days
    minimumCacheTTL: 60 * 60 * 24 * 60,
  },

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
