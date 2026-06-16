import type { Metadata, Viewport } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { AuthProvider } from '@/providers/auth-provider'
import { Toaster } from '@/components/ui/toaster'
import { CustomCursor } from '@/components/ui/cursor'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'MedLink Cloud',
    template: '%s | MedLink Cloud',
  },
  description: 'Pharmacy management for modern healthcare',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'MedLink Cloud',
  },
}

export const viewport: Viewport = {
  themeColor: '#0F7938',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="font-sans antialiased min-h-screen bg-background">
          <AuthProvider>
            <CustomCursor />
            {children}
            <Toaster />
          </AuthProvider>
        </body>
    </html>
  )
}
