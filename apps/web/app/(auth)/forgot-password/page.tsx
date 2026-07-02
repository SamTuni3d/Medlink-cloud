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

function FormField({
  icon: Icon, type = 'text', placeholder, autoComplete, error, ...rest
}: {
  icon: React.ElementType; type?: string; placeholder: string
  autoComplete?: string; error?: string
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/25" />
        <input
          type={type} placeholder={placeholder} autoComplete={autoComplete}
          className="h-12 w-full rounded-xl border border-white/[0.08] bg-white/[0.05] pl-11 pr-4 text-sm text-white placeholder:text-white/25 transition-all duration-200 focus:border-purple-500/50 focus:bg-white/[0.08] focus:shadow-[0_0_0_3px_rgba(147,51,234,0.12)] focus:outline-none"
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
      const result = await requestPasswordReset(fd)
      if (result?.error) form.setError('root', { message: result.error })
      else setSent(true)
    })
  }

  if (sent) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-purple-500/25 bg-purple-500/10">
          <MailCheck className="h-7 w-7 text-purple-400" />
        </div>
        <h1 className="text-2xl font-bold text-white">Check your email</h1>
        <p className="mt-2 text-sm text-white/40">
          We sent a reset link to{' '}
          <span className="text-white/70">{form.getValues('email')}</span>
        </p>
        <Link
          href="/login"
          className="mt-8 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.05] text-sm font-medium text-white/65 transition-all hover:border-white/[0.15] hover:bg-white/[0.08] hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-[1.9rem] font-bold tracking-tight text-white">Reset password</h1>
      <p className="mt-2 text-sm text-white/40">
        Enter your email and we&apos;ll send you a reset link.
      </p>

      <form onSubmit={form.handleSubmit(onSubmit)} className="mt-8 space-y-3.5" noValidate>
        <FormField
          icon={Mail} type="email" placeholder="Email"
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
          className="auth-btn-shimmer relative mt-1 h-12 w-full overflow-hidden rounded-xl bg-purple-600 font-semibold text-white shadow-[0_0_28px_rgba(147,51,234,0.3)] transition-all duration-300 disabled:opacity-60 hover:bg-purple-500 hover:shadow-[0_0_44px_rgba(147,51,234,0.5)]"
        >
          <span className="relative flex items-center justify-center gap-2 text-sm">
            {isPending
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
              : 'Send reset link'}
          </span>
        </motion.button>
      </form>

      <div className="mt-6">
        <Link
          href="/login"
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.05] text-sm font-medium text-white/65 transition-all hover:border-white/[0.15] hover:bg-white/[0.08] hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to sign in
        </Link>
      </div>
    </div>
  )
}
