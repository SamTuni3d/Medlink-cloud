'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { FloatingBackground } from '@/components/auth/floating-background'

const SLIDES = [
  {
    title: 'Connecting Ghana\'s Healthcare Ecosystem',
    sub:   'One platform for pharmacies, clinics, labs and hospitals.',
  },
  {
    title: 'Pharmacy Management. Reimagined.',
    sub:   'Real-time inventory, offline POS, and instant reporting.',
  },
  {
    title: 'Secure. Fast. Reliable.',
    sub:   'Enterprise-grade security built for healthcare professionals.',
  },
]

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % SLIDES.length), 4500)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="dark flex min-h-svh bg-[#0d0d1a]">

      {/* ── Left: visual / branding panel ─────────────────────────────── */}
      <div className="relative hidden w-[46%] flex-col overflow-hidden lg:flex">
        <FloatingBackground />

        {/* Top bar */}
        <div className="relative z-10 flex items-center justify-between p-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="MedLink" className="h-8 w-auto" />
          <Link
            href="/"
            className="flex items-center gap-1.5 rounded-full border border-white/15 bg-black/20 px-4 py-1.5 text-sm text-white/60 backdrop-blur-sm transition-colors hover:border-white/30 hover:text-white/90"
          >
            Back to website <span aria-hidden="true">→</span>
          </Link>
        </div>

        {/* Bottom tagline + dots */}
        <div className="relative z-10 mt-auto p-10 pb-12">
          <div key={idx} className="space-y-2">
            <h2 className="text-3xl font-bold leading-tight text-white">{SLIDES[idx]?.title}</h2>
            <p className="text-sm text-white/45">{SLIDES[idx]?.sub}</p>
          </div>
          <div className="mt-6 flex items-center gap-2">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                aria-label={`Slide ${i + 1}`}
                className={`h-1.5 rounded-full transition-all duration-400 ${
                  i === idx ? 'w-8 bg-white/80' : 'w-4 bg-white/25 hover:bg-white/40'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── Right: form panel ──────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col items-center justify-center bg-[#111120] px-6 py-14 sm:px-10">
        {/* Mobile-only logo */}
        <div className="mb-10 lg:hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="MedLink" className="h-8 w-auto" />
        </div>
        <div className="w-full max-w-[400px]">{children}</div>
      </div>

    </div>
  )
}
