import type { ReactNode } from 'react'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh w-full">

      {/* ── Left: blue gradient branding panel ──────────────────────────── */}
      <div
        className="relative hidden w-[46%] overflow-hidden lg:flex lg:flex-col"
        style={{ background: 'linear-gradient(150deg,#58111A 0%,#7a1a26 45%,#9b3040 100%)' }}
      >
        {/* Decorative shapes */}
        <div className="pointer-events-none absolute -right-24 -top-20 h-80 w-80 rounded-full border-[48px] border-white/10" />
        <div className="pointer-events-none absolute left-12 top-[200px] h-12 w-12 rounded-full bg-[#ff6b6b]" style={{ boxShadow: '0 8px 24px rgba(255,107,107,.4)' }} />
        <div className="pointer-events-none absolute left-32 top-[160px] h-20 w-5 rounded-full bg-[#ffc542]" style={{ transform: 'rotate(-30deg)', boxShadow: '0 8px 24px rgba(255,197,66,.4)' }} />
        <div className="pointer-events-none absolute left-40 top-[200px] h-16 w-4 rounded-full bg-[#ff8fab]" style={{ transform: 'rotate(-30deg)' }} />
        <div className="pointer-events-none absolute -bottom-20 -right-14 h-72 w-72 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -left-7 bottom-28 h-20 w-20 rounded-full bg-[#2ed8b6] opacity-35" />
        {/* Medical cross */}
        <svg
          className="pointer-events-none absolute opacity-10"
          style={{ top: '50%', left: '50%', transform: 'translate(-40%, -44%)', width: 200, height: 200 }}
          viewBox="0 0 200 200" fill="none"
        >
          <rect x="70" y="0" width="60" height="200" rx="12" fill="white" />
          <rect x="0" y="70" width="200" height="60" rx="12" fill="white" />
        </svg>

        {/* Logo */}
        <div className="relative z-10 px-8 pt-8">
          <div className="inline-flex items-center rounded-2xl bg-white/95 px-4 py-2.5 shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="MedLink" className="h-10 w-auto" />
          </div>
        </div>

        {/* Copy */}
        <div className="relative z-10 flex-1 px-8 pt-8">
          <h2 className="mb-3 text-[1.9rem] font-extrabold leading-tight tracking-tight text-white" style={{ textWrap: 'balance' } as React.CSSProperties}>
            The Next Generation
            <span className="mt-1 block text-[1.3rem] font-semibold text-white/65">
              of Pharmacy Management
            </span>
          </h2>
          <p className="max-w-[260px] text-[0.82rem] leading-relaxed text-white/65">
            MedLink connects pharmacies, patients, and healthcare providers on
            one secure platform. Smarter tools. Better care. Together.
          </p>
        </div>

        {/* Copyright */}
        <div className="relative z-10 px-8 pb-6 text-[0.6rem] font-medium text-white/38">
          © 2025 MedLink Cloud. All rights reserved.
        </div>
      </div>

      {/* ── Right: form panel ───────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col items-center justify-center bg-white px-6 py-12 sm:px-10">
        {/* Mobile logo */}
        <div className="mb-8 lg:hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="MedLink" className="h-10 w-auto" />
        </div>
        <div className="w-full max-w-[340px]">{children}</div>
      </div>

    </div>
  )
}
