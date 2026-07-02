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
  icon: Icon,
  type = 'text',
  placeholder,
  autoComplete,
  error,
  ...rest
}: {
  icon: React.ElementType
  type?: string
  placeholder: string
  autoComplete?: string
  error?: string
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/25" />
        <input
          type={type}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.06] pl-10 pr-4 text-sm text-white placeholder:text-white/20 backdrop-blur-sm transition-all duration-200 focus:border-blue-500/60 focus:bg-white/[0.09] focus:shadow-[0_0_0_3px_rgba(37,99,235,0.14)] focus:outline-none"
          {...rest}
        />
      </div>
      {error && <p className="pl-1 text-xs text-red-400">{error}</p>}
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
      const result = await requestPasswordReset(fd)
      if (result?.error) form.setError('root', { message: result.error })
      else setSent(true)
    })
  }

  /* ── Success state ── */
  if (sent) {
    return (
      <div className="rounded-[26px] border border-white/[0.09] bg-white/[0.04] p-10 text-center shadow-[0_30px_70px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.09)] backdrop-blur-[48px]">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10">
          <MailCheck className="h-7 w-7 text-emerald-400" />
        </div>
        <h2 className="text-xl font-bold text-white">Check your email</h2>
        <p className="mt-2 text-sm text-white/40">
          We sent a reset link to{' '}
          <span className="text-white/70">{form.getValues('email')}</span>
        </p>
        <Link
          href="/login"
          className="mt-7 flex h-11 w-full items-center justify-center rounded-full border border-white/[0.09] bg-white/[0.04] text-sm font-medium text-white/60 transition-all duration-200 hover:border-white/[0.16] hover:bg-white/[0.08] hover:text-white"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="rounded-[26px] border border-white/[0.09] bg-white/[0.04] p-8 shadow-[0_30px_70px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.09),inset_0_-1px_0_rgba(0,0,0,0.2)] backdrop-blur-[48px]">
      {/* Logo */}
      <div className="mb-7 flex flex-col items-center gap-2.5">
        <div className="relative">
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
        <h1 className="text-[1.5rem] font-bold text-white">Reset password</h1>
        <p className="mt-1.5 text-sm text-white/35">
          Enter your email and we&apos;ll send a reset link
        </p>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
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

        {form.formState.errors.root && (
          <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {form.formState.errors.root.message}
          </p>
        )}

        <motion.button
          type="submit"
          disabled={isPending}
          whileHover={!isPending ? { scale: 1.018 } : undefined}
          whileTap={!isPending  ? { scale: 0.975 } : undefined}
          className="auth-btn-shimmer relative mt-1 h-12 w-full overflow-hidden rounded-full bg-gradient-to-r from-blue-700 via-blue-600 to-blue-500 font-semibold text-white shadow-[0_0_28px_rgba(37,99,235,0.38)] transition-shadow duration-300 disabled:cursor-not-allowed disabled:opacity-60 hover:shadow-[0_0_48px_rgba(37,99,235,0.55)]"
        >
          <span className="relative flex items-center justify-center gap-2 text-sm">
            {isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
            ) : 'Send Reset Link'}
          </span>
        </motion.button>
      </form>

      <div className="mt-6">
        <Link
          href="/login"
          className="flex h-11 w-full items-center justify-center gap-2 rounded-full border border-white/[0.09] bg-white/[0.04] text-sm font-medium text-white/60 transition-all duration-200 hover:border-white/[0.16] hover:bg-white/[0.08] hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to sign in
        </Link>
      </div>
    </div>
  )
}
