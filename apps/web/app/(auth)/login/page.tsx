'use client'

import { Suspense, useTransition, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react'
import { signIn } from './actions'

const schema = z.object({
  email:    z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})
type FormValues = z.infer<typeof schema>

function GlassInput({
  icon: Icon, type = 'text', placeholder, autoComplete, error, rightSlot, ...rest
}: {
  icon: React.ElementType; type?: string; placeholder: string
  autoComplete?: string; error?: string; rightSlot?: React.ReactNode
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
        <input
          type={type} placeholder={placeholder} autoComplete={autoComplete}
          className="h-11 w-full rounded-xl bg-white/[0.07] pl-11 pr-4 text-sm text-white placeholder:text-white/30 transition-all duration-200 focus:bg-white/[0.10] focus:outline-none"
          {...rest}
        />
        {rightSlot && (
          <div className="absolute right-0 top-0 flex h-full items-center pr-4">{rightSlot}</div>
        )}
      </div>
      {error && <p className="mt-1.5 pl-1 text-xs text-red-400">{error}</p>}
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

function AppleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
    </svg>
  )
}

function LoginForm() {
  const [isPending, startTransition] = useTransition()
  const [showPw, setShowPw] = useState(false)
  const searchParams  = useSearchParams()
  const callbackError = searchParams.get('error')

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
    /* Frosted glass card */
    <div
      className="w-full rounded-2xl p-7"
      style={{
        background: 'rgba(20,5,50,0.55)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        boxShadow: '0 8px 48px rgba(0,0,0,0.35)',
      }}
    >
      <h1 className="text-2xl font-bold tracking-tight text-white">Sign in</h1>
      <p className="mt-1.5 text-xs text-white/35">
        New to MedLink?{' '}
        <Link href="/register" className="text-purple-300 transition-colors hover:text-purple-200">
          Create an account
        </Link>
      </p>

      {callbackError === 'auth_callback_failed' && (
        <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          That link has expired. Please request a new one.
        </div>
      )}

      <form onSubmit={form.handleSubmit(onSubmit)} className="mt-5 space-y-3" noValidate>
        <GlassInput
          icon={Mail} type="email" placeholder="Email address"
          autoComplete="email"
          error={form.formState.errors.email?.message}
          {...form.register('email')}
        />

        <div className="space-y-1">
          <GlassInput
            icon={Lock}
            type={showPw ? 'text' : 'password'}
            placeholder="Password"
            autoComplete="current-password"
            error={form.formState.errors.password?.message}
            rightSlot={
              <button type="button" onClick={() => setShowPw(v => !v)} tabIndex={-1}
                aria-label={showPw ? 'Hide password' : 'Show password'}
                className="text-white/30 transition-colors hover:text-white/60">
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            }
            {...form.register('password')}
          />
          <div className="text-right">
            <Link href="/forgot-password"
              className="text-[11px] text-white/30 transition-colors hover:text-white/55"
              tabIndex={-1}>
              Forgot password?
            </Link>
          </div>
        </div>

        {form.formState.errors.root && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {form.formState.errors.root.message}
          </div>
        )}

        <motion.button
          type="submit" disabled={isPending}
          whileHover={!isPending ? { scale: 1.016 } : undefined}
          whileTap={!isPending  ? { scale: 0.978 } : undefined}
          className="auth-btn-shimmer relative mt-1 h-11 w-full overflow-hidden rounded-xl font-semibold text-white shadow-lg transition-all duration-300 disabled:opacity-60"
          style={{
            background: isPending
              ? 'linear-gradient(90deg,#c2410c,#dc2626)'
              : 'linear-gradient(90deg,#f97316,#ef4444)',
            boxShadow: '0 4px 24px rgba(249,115,22,0.35)',
          }}
        >
          <span className="relative flex items-center justify-center gap-2 text-sm">
            {isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Signing in…</> : 'Sign in'}
          </span>
        </motion.button>
      </form>

      {/* Social */}
      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-white/[0.08]" />
        <span className="text-[11px] text-white/25">or continue with</span>
        <div className="h-px flex-1 bg-white/[0.08]" />
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          className="flex h-10 items-center justify-center gap-2 rounded-xl bg-white/[0.05] text-xs font-medium text-white/60 transition-all hover:bg-white/[0.09] hover:text-white"
        >
          <GoogleIcon /> Google
        </button>
        <button
          type="button"
          className="flex h-10 items-center justify-center gap-2 rounded-xl bg-white/[0.05] text-xs font-medium text-white/60 transition-all hover:bg-white/[0.09] hover:text-white"
        >
          <AppleIcon /> Apple
        </button>
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
