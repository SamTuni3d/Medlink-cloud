'use client'

import { Suspense, useTransition, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { Mail, Lock, Eye, EyeOff, CheckCircle2, Loader2 } from 'lucide-react'
import { signIn } from './actions'

const schema = z.object({
  email:    z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})
type FormValues = z.infer<typeof schema>

/* ── Shared glass primitives ──────────────────────────────────────────────── */
function GlassInput({
  icon: Icon,
  type = 'text',
  placeholder,
  autoComplete,
  error,
  rightSlot,
  ...rest
}: {
  icon: React.ElementType
  type?: string
  placeholder: string
  autoComplete?: string
  error?: string
  rightSlot?: React.ReactNode
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/25 transition-colors peer-focus:text-blue-400" />
        <input
          type={type}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="peer h-12 w-full rounded-xl border border-white/10 bg-white/[0.06] pl-10 pr-11 text-sm text-white placeholder:text-white/20 backdrop-blur-sm transition-all duration-200 focus:border-blue-500/60 focus:bg-white/[0.09] focus:shadow-[0_0_0_3px_rgba(37,99,235,0.14)] focus:outline-none"
          {...rest}
        />
        {rightSlot && (
          <div className="absolute right-0 top-0 flex h-full items-center pr-3.5">
            {rightSlot}
          </div>
        )}
      </div>
      {error && <p className="pl-1 text-xs text-red-400">{error}</p>}
    </div>
  )
}

function LiquidButton({
  children,
  disabled,
  type = 'button',
}: {
  children: React.ReactNode
  disabled?: boolean
  type?: 'button' | 'submit'
}) {
  return (
    <motion.button
      type={type}
      disabled={disabled}
      whileHover={!disabled ? { scale: 1.018 } : undefined}
      whileTap={!disabled  ? { scale: 0.975 } : undefined}
      className="auth-btn-shimmer relative mt-1 h-12 w-full overflow-hidden rounded-full bg-gradient-to-r from-blue-700 via-blue-600 to-blue-500 font-semibold text-white shadow-[0_0_28px_rgba(37,99,235,0.38)] transition-shadow duration-300 disabled:cursor-not-allowed disabled:opacity-60 hover:shadow-[0_0_48px_rgba(37,99,235,0.55)]"
    >
      <span className="relative flex items-center justify-center gap-2 text-sm">
        {children}
      </span>
    </motion.button>
  )
}

/* ── Main form ────────────────────────────────────────────────────────────── */
function LoginForm() {
  const [isPending, startTransition] = useTransition()
  const [showPw, setShowPw] = useState(false)
  const searchParams   = useSearchParams()
  const callbackError  = searchParams.get('error')

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  })

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      const fd = new FormData()
      fd.set('email', values.email)
      fd.set('password', values.password)
      const result = await signIn(fd)
      if (result?.error) form.setError('root', { message: result.error })
    })
  }

  return (
    <div>
      {/* ── Glass card ──────────────────────────────────────────────────── */}
      <div className="rounded-[26px] border border-white/[0.09] bg-white/[0.04] p-8 shadow-[0_30px_70px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.09),inset_0_-1px_0_rgba(0,0,0,0.2)] backdrop-blur-[48px]">

        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-2.5">
          <div className="relative">
            {/* Breathing glow ring behind logo */}
            <div className="auth-glow-breathe absolute -inset-3 rounded-full bg-blue-500/15 blur-xl" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="MedLink" className="relative h-10 w-auto" />
          </div>
          <span className="text-[10px] font-semibold tracking-[0.25em] text-white/35 uppercase">
            MedLink Cloud
          </span>
        </div>

        {/* Heading */}
        <div className="mb-7 text-center">
          <h1 className="text-[1.6rem] font-bold leading-tight text-white">Welcome Back</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-white/35">
            Secure access to Ghana&apos;s connected healthcare ecosystem
          </p>
        </div>

        {/* Callback error */}
        {callbackError === 'auth_callback_failed' && (
          <div className="mb-5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            That link has expired. Please request a new one.
          </div>
        )}

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {/* Email */}
          <div className="space-y-1">
            <label className="block pl-0.5 text-[11px] font-semibold tracking-widest text-white/40 uppercase">
              Email Address
            </label>
            <GlassInput
              icon={Mail}
              type="email"
              placeholder="you@pharmacy.com"
              autoComplete="email"
              error={form.formState.errors.email?.message}
              {...form.register('email')}
            />
          </div>

          {/* Password */}
          <div className="space-y-1">
            <div className="flex items-center justify-between pl-0.5">
              <label className="text-[11px] font-semibold tracking-widest text-white/40 uppercase">
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-[11px] text-blue-400/70 transition-colors hover:text-blue-400"
                tabIndex={-1}
              >
                Forgot password?
              </Link>
            </div>
            <GlassInput
              icon={Lock}
              type={showPw ? 'text' : 'password'}
              placeholder="••••••••"
              autoComplete="current-password"
              error={form.formState.errors.password?.message}
              rightSlot={
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  tabIndex={-1}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                  className="text-white/25 transition-colors hover:text-white/60"
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
              {...form.register('password')}
            />
          </div>

          {/* Server error */}
          {form.formState.errors.root && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {form.formState.errors.root.message}
            </div>
          )}

          {/* CTA */}
          <LiquidButton type="submit" disabled={isPending}>
            {isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Signing in…</>
            ) : 'Sign In'}
          </LiquidButton>
        </form>

        {/* Divider */}
        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-white/[0.08]" />
          <span className="text-[11px] text-white/25">New to MedLink?</span>
          <div className="h-px flex-1 bg-white/[0.08]" />
        </div>

        {/* Create account */}
        <Link
          href="/register"
          className="flex h-11 w-full items-center justify-center rounded-full border border-white/[0.09] bg-white/[0.04] text-sm font-medium text-white/60 transition-all duration-200 hover:border-white/[0.16] hover:bg-white/[0.08] hover:text-white"
        >
          Create your pharmacy account →
        </Link>
      </div>

      {/* Security badges */}
      <div className="mt-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-5 py-3.5 backdrop-blur-sm">
        <div className="grid grid-cols-2 gap-y-2 gap-x-4">
          {[
            'End-to-end encrypted',
            'HIPAA-ready architecture',
            'GDPR compliant',
            'Ghana Health Service',
          ].map(b => (
            <div key={b} className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-500/60" />
              <span className="text-[11px] text-white/30">{b}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
