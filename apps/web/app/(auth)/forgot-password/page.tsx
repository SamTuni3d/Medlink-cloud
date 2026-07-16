'use client'

import { useTransition, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Mail, ArrowLeft, Loader2, MailCheck } from 'lucide-react'
import { requestPasswordReset } from './actions'

const schema = z.object({ email: z.string().email('Enter a valid email') })
type FormValues = z.infer<typeof schema>

function GlassInput({
  icon: Icon, type = 'text', placeholder, autoComplete, error, ...rest
}: {
  icon: React.ElementType; type?: string; placeholder: string
  autoComplete?: string; error?: string
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
      </div>
      {error && <p className="mt-1.5 pl-1 text-xs text-red-400">{error}</p>}
    </div>
  )
}

export default function ForgotPasswordPage() {
  const [isPending, startTransition] = useTransition()
  const [sent, setSent] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  })

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      const fd = new FormData()
      fd.set('email', values.email)
      await requestPasswordReset(fd)
      // Always show success — the action never reveals whether the email exists
      setSent(true)
    })
  }

  if (sent) {
    return (
      <div
        className="w-full rounded-2xl p-7 text-center"
        style={{
          background: 'rgba(20,5,50,0.55)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          boxShadow: '0 8px 48px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08)',
        }}
      >
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-orange-400/25 bg-orange-400/10">
          <MailCheck className="h-6 w-6 text-orange-400" />
        </div>
        <h1 className="text-2xl font-bold text-white">Check your email</h1>
        <p className="mt-2 text-sm text-white/40">
          We sent a reset link to{' '}
          <span className="text-white/70">{form.getValues('email')}</span>
        </p>
        <Link
          href="/login"
          className="mt-7 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white/[0.06] text-sm font-medium text-white/60 transition-all hover:bg-white/[0.10] hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <div
      className="w-full rounded-2xl p-7"
      style={{
        background: 'rgba(20,5,50,0.55)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        boxShadow: '0 8px 48px rgba(0,0,0,0.35)',
      }}
    >
      <h1 className="text-2xl font-bold tracking-tight text-white">Reset password</h1>
      <p className="mt-1.5 text-xs text-white/35">
        Enter your email and we&apos;ll send you a reset link.
      </p>

      <form onSubmit={form.handleSubmit(onSubmit)} className="mt-5 space-y-3" noValidate>
        <GlassInput
          icon={Mail} type="email" placeholder="Email address"
          autoComplete="email"
          error={form.formState.errors.email?.message}
          {...form.register('email')}
        />

        {form.formState.errors.root && (
          <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {form.formState.errors.root.message}
          </p>
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
            {isPending
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
              : 'Send reset link'}
          </span>
        </motion.button>
      </form>

      <div className="mt-4">
        <Link
          href="/login"
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white/[0.06] text-sm font-medium text-white/60 transition-all hover:bg-white/[0.10] hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to sign in
        </Link>
      </div>
    </div>
  )
}
