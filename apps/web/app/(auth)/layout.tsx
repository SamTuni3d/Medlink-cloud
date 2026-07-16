'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { FloatingBackground } from '@/components/auth/floating-background'

const SLIDES = [
  { headline: 'Welcome!',           sub: 'Ghana\'s most connected pharmacy platform.' },
  { headline: 'Built for speed.',   sub: 'Real-time inventory, offline POS, instant reports.' },
  { headline: 'Trusted & secure.',  sub: 'Enterprise-grade security for every pharmacy.' },
]

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % SLIDES.length), 4500)
    return () => clearInterval(t)
  }, [])

  return (
    /*
     * Full-screen deep-purple base — the FloatingBackground is `absolute`
     * so it fills only the left column; no overflow leaks to the right.
     */
    <div
      className="dark flex min-h-svh w-full"
      style={{ background: 'linear-gradient(135deg,#3b0764 0%,#4c1d95 40%,#2e0657 100%)' }}
    >
      {/* ── Left: branding panel ───────────────────────────────────────── */}
      <div className="relative hidden w-[52%] flex-col overflow-hidden lg:flex">
        <FloatingBackground />

        {/* Logo */}
        <div className="relative z-10 p-10 pb-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="MedLink" className="h-8 w-auto" />
          <div className="mt-4 h-0.5 w-8 rounded-full bg-white/40" />
        </div>

        {/* Main copy */}
        <div className="relative z-10 mt-auto p-10 pb-6">
          <h1
            key={idx}
            className="text-6xl font-extrabold leading-tight tracking-tight text-white"
          >
            {SLIDES[idx]?.headline}
          </h1>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/50">
            {SLIDES[idx]?.sub}
          </p>

          <Link
            href="/register"
            className="mt-8 inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold text-white shadow-lg transition-opacity hover:opacity-90"
            style={{ background: 'linear-gradient(90deg,#f97316,#ef4444)' }}
          >
            Get started →
          </Link>
        </div>

        {/* Slide dots */}
        <div className="relative z-10 flex items-center gap-2 px-10 pb-10">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              aria-label={`Slide ${i + 1}`}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === idx ? 'w-8 bg-white/80' : 'w-4 bg-white/25 hover:bg-white/40'
              }`}
            />
          ))}
        </div>
      </div>

      {/* ── Right: form panel ──────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-14 sm:px-10"
           style={{ background: 'rgba(18,4,48,0.55)', backdropFilter: 'blur(2px)' }}>
        {/* Mobile logo */}
        <div className="mb-10 lg:hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="MedLink" className="h-8 w-auto" />
        </div>
        <div className="w-full max-w-[390px]">{children}</div>
      </div>
    </div>
  )
}
