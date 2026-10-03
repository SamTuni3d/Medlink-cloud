'use client'

import { Suspense, useTransition, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Eye, EyeOff, Globe, Activity, Shield, Droplets, Lock, Heart,
} from 'lucide-react'
import { signIn } from './actions'

const schema = z.object({
  email:    z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})
type FormValues = z.infer<typeof schema>

// ── Mobile hero: floating icon bubbles ────────────────────────────────────────

function Bubble({
  size, style, children,
}: {
  size: number
  style?: React.CSSProperties
  children: React.ReactNode
}) {
  return (
    <div
      className="absolute flex items-center justify-center rounded-full shadow-lg"
      style={{
        width: size,
        height: size,
        background: 'rgba(13,148,136,0.82)',
        border: '2px solid rgba(255,255,255,0.25)',
        backdropFilter: 'blur(4px)',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

function MobileHero() {
  return (
    <div
      className="relative w-full overflow-hidden lg:hidden"
      style={{
        height: '46vh',
        minHeight: 240,
        background: 'linear-gradient(160deg, #0ABFBC 0%, #0D9488 45%, #0B7070 100%)',
      }}
    >
      {/* Abstract background shapes */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.08]"
        viewBox="0 0 420 320"
        preserveAspectRatio="xMidYMid slice"
      >
        <circle cx="370" cy="40" r="130" fill="white" />
        <circle cx="40" cy="280" r="90" fill="white" />
        {/* Medical cross */}
        <rect x="155" y="85" width="38" height="140" rx="8" fill="white" />
        <rect x="90" y="148" width="168" height="38" rx="8" fill="white" />
      </svg>

      {/* Brand */}
      <div className="absolute left-0 right-0 top-7 flex justify-center">
        <div className="text-center">
          <p className="text-[2rem] font-black leading-none tracking-tight">
            <span style={{ color: '#134E4A' }}>Med</span>
            <span className="text-white">Link</span>
          </p>
          <p className="mt-1 text-[0.65rem] font-semibold tracking-[0.22em] text-white/60 uppercase">
            we connect pharmacies
          </p>
        </div>
      </div>

      {/* Floating icon bubbles — positioned to echo the reference */}
      <div className="absolute inset-0">
        {/* Globe — top left */}
        <Bubble size={52} style={{ top: '28%', left: '6%' }}>
          <Globe className="h-6 w-6 text-white" />
        </Bubble>

        {/* Disability icon — left mid */}
        <Bubble size={62} style={{ top: '50%', left: '2%' }}>
          <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <circle cx="12" cy="5" r="2" fill="currentColor" stroke="none" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 10h3.5l1.5 3.5H17M10 19c-1.5 0-2.5-1.2-2.5-2.5l1-4" />
          </svg>
        </Bubble>

        {/* HEALTH text — center */}
        <Bubble size={62} style={{ top: '38%', left: '26%' }}>
          <span className="text-[9px] font-bold tracking-[0.15em] text-white">HEALTH</span>
        </Bubble>

        {/* Activity / heartbeat — center-right, largest */}
        <Bubble size={78} style={{ top: '22%', left: '46%' }}>
          <Activity className="h-9 w-9 text-white" />
        </Bubble>

        {/* Medical care — far right, dashed border */}
        <Bubble
          size={66}
          style={{
            top: '24%',
            right: '4%',
            background: 'rgba(11,112,112,0.65)',
            border: '2px dashed rgba(255,255,255,0.45)',
          }}
        >
          <div className="flex flex-col items-center gap-0.5">
            <Shield className="h-5 w-5 text-white" />
            <span className="text-center text-[7px] font-bold leading-tight text-white">
              MEDICAL<br />CARE
            </span>
          </div>
        </Bubble>

        {/* Heart — bottom center */}
        <Bubble size={46} style={{ bottom: '12%', left: '44%', opacity: 0.75 }}>
          <Heart className="h-5 w-5 text-white" />
        </Bubble>

        {/* Droplets — bottom right */}
        <Bubble size={42} style={{ bottom: '8%', right: '22%', opacity: 0.6 }}>
          <Droplets className="h-5 w-5 text-white" />
        </Bubble>
      </div>
    </div>
  )
}

// ── Mobile login badge (lock circle at the seam) ──────────────────────────────

function LoginBadge() {
  return (
    <div className="relative z-10 flex justify-center lg:hidden" style={{ marginTop: -38 }}>
      <div
        className="flex h-[76px] w-[76px] flex-col items-center justify-center rounded-full shadow-xl"
        style={{
          background: 'linear-gradient(135deg, #0ABFBC, #0B7070)',
          border: '4px solid white',
        }}
      >
        <Lock className="h-8 w-8 text-white" />
      </div>
    </div>
  )
}

// ── The actual form, shared across mobile + desktop ───────────────────────────

function LoginForm() {
  const [isPending, startTransition] = useTransition()
  const [showPw, setShowPw]          = useState(false)
  const searchParams                 = useSearchParams()
  const callbackError                = searchParams.get('error')

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  })

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      const fd = new FormData()
      fd.set('email', values.email)
      fd.set('password', values.password)
      const result = await signIn(fd)
      if (result?.error) setError('root', { message: result.error })
    })
  }

  return (
    <>
      {/* ── MOBILE LAYOUT ── */}
      <div className="flex min-h-svh flex-col lg:hidden">
        <MobileHero />
        <LoginBadge />

        {/* Teal form area */}
        <div className="flex flex-1 flex-col px-6 pb-8 pt-6" style={{ background: '#0F766E' }}>
          {callbackError === 'auth_callback_failed' && (
            <div className="mb-4 rounded-xl bg-red-500/20 px-4 py-3 text-sm text-red-200">
              That link has expired. Please request a new one.
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {/* Email */}
            <div>
              <input
                type="email"
                placeholder="Enter Email"
                autoComplete="email"
                className="w-full rounded-full px-5 py-3.5 text-sm text-white outline-none placeholder:text-white/45 transition-all focus:ring-2 focus:ring-white/30"
                style={{ background: 'rgba(255,255,255,0.15)', border: 'none' }}
                {...register('email')}
              />
              {errors.email && (
                <p className="mt-1.5 pl-4 text-xs text-red-300">{errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  placeholder="••••••••••"
                  autoComplete="current-password"
                  className="w-full rounded-full px-5 py-3.5 pr-12 text-sm text-white outline-none placeholder:text-white/45 transition-all focus:ring-2 focus:ring-white/30"
                  style={{ background: 'rgba(255,255,255,0.15)', border: 'none' }}
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  tabIndex={-1}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/45 hover:text-white/70"
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1.5 pl-4 text-xs text-red-300">{errors.password.message}</p>
              )}
            </div>

            {/* Forgot */}
            <div className="flex justify-end">
              <Link
                href="/forgot-password"
                className="text-xs italic text-white/55 hover:text-white/80"
              >
                Forget Password?
              </Link>
            </div>

            {errors.root && (
              <div className="rounded-full bg-red-500/20 px-5 py-3 text-center text-sm text-red-200">
                {errors.root.message}
              </div>
            )}

            {/* LOGIN */}
            <button
              type="submit"
              disabled={isPending}
              className="w-full rounded-full py-3.5 text-sm font-bold tracking-[0.15em] text-white disabled:opacity-60"
              style={{
                background: 'linear-gradient(90deg, #0ABFBC, #0891B2)',
                boxShadow: '0 4px 20px rgba(10,191,188,0.45)',
              }}
            >
              {isPending ? 'SIGNING IN…' : 'LOGIN'}
            </button>
          </form>

          <div className="flex-1" />

          {/* SIGNUP */}
          <Link
            href="/register"
            className="mt-8 block w-full rounded-full py-3.5 text-center text-sm font-bold text-white"
            style={{
              background: 'linear-gradient(90deg, #F59E0B, #F97316)',
              boxShadow: '0 4px 16px rgba(245,158,11,0.4)',
            }}
          >
            <span className="font-normal italic text-white/75">Not Registered yet? </span>
            SIGNUP
          </Link>
        </div>
      </div>

      {/* ── DESKTOP LAYOUT (inside white right panel from layout.tsx) ── */}
      <div className="hidden lg:block">
        {/* Tab switcher */}
        <div className="mb-7 flex gap-7 border-b border-gray-100">
          <Link
            href="/register"
            className="pb-2.5 text-base font-semibold text-gray-400 transition-colors hover:text-gray-600"
          >
            Sign Up
          </Link>
          <span className="relative pb-2.5 text-base font-bold text-gray-900 after:absolute after:inset-x-0 after:-bottom-px after:h-[2.5px] after:rounded-full after:bg-teal-600">
            Sign In
          </span>
        </div>

        <p className="mb-6 text-sm text-gray-400">
          Please enter your details below to continue
        </p>

        {callbackError === 'auth_callback_failed' && (
          <div className="mb-5 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
            That link has expired. Please request a new one.
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-teal-700">E-mail</label>
            <input
              type="email"
              placeholder="Enter your email"
              autoComplete="email"
              className="w-full border-0 border-b border-gray-200 bg-transparent px-0 py-2 text-sm text-gray-900 placeholder:text-gray-300 transition-colors focus:border-teal-600 focus:outline-none focus:ring-0"
              {...register('email')}
            />
            {errors.email && (
              <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>
            )}
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-semibold text-teal-700">Password</label>
              <Link
                href="/forgot-password"
                className="text-xs font-semibold text-teal-700 hover:opacity-80"
                tabIndex={-1}
              >
                Forgot your password?
              </Link>
            </div>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                placeholder="Enter your password"
                autoComplete="current-password"
                className="w-full border-0 border-b border-gray-200 bg-transparent px-0 py-2 pr-8 text-sm text-gray-900 placeholder:text-gray-300 transition-colors focus:border-teal-600 focus:outline-none focus:ring-0"
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                tabIndex={-1}
                className="absolute right-0 top-1/2 -translate-y-1/2 text-gray-300 transition-colors hover:text-gray-500"
                aria-label={showPw ? 'Hide password' : 'Show password'}
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>
            )}
          </div>

          {errors.root && (
            <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
              {errors.root.message}
            </div>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="mt-2 w-full rounded-xl py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{
              background: 'linear-gradient(90deg, #0ABFBC, #0D9488)',
              boxShadow: '0 4px 18px rgba(13,148,136,.35)',
            }}
          >
            {isPending ? 'Signing in…' : 'Login'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-400">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="font-bold text-teal-700 hover:opacity-80">
            Sign Up
          </Link>
        </p>
      </div>
    </>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
