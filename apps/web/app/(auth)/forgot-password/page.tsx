'use client'

import { useTransition, useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { MailCheck, ArrowLeft } from 'lucide-react'
import { requestPasswordReset } from './actions'

const schema = z.object({ email: z.string().email('Enter a valid email') })
type FormValues = z.infer<typeof schema>

const inputCls =
  'w-full border-0 border-b border-gray-200 bg-transparent px-0 py-2 text-sm text-gray-900 placeholder:text-gray-300 focus:border-[#58111A] focus:outline-none focus:ring-0 transition-colors'

export default function ForgotPasswordPage() {
  const [isPending, startTransition] = useTransition()
  const [sent, setSent]              = useState(false)

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  })

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      const fd = new FormData()
      fd.set('email', values.email)
      await requestPasswordReset(fd)
      setSent(true)
    })
  }

  if (sent) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-rose-50">
          <MailCheck className="h-7 w-7 text-[#58111A]" />
        </div>
        <h1 className="text-xl font-bold text-gray-900">Check your email</h1>
        <p className="mt-2 text-sm text-gray-500">
          We sent a reset link to{' '}
          <span className="font-semibold text-gray-700">{getValues('email')}</span>
        </p>
        <p className="mt-1 text-xs text-gray-400">
          Didn&apos;t receive it? Check your spam folder.
        </p>
        <Link
          href="/login"
          className="mt-7 flex items-center justify-center gap-2 rounded-xl border border-gray-200 py-3 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <div>
      <Link
        href="/login"
        className="mb-8 inline-flex items-center gap-1.5 text-xs font-semibold text-gray-400 transition-colors hover:text-gray-600"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to sign in
      </Link>

      <h1 className="mb-1 text-2xl font-bold text-gray-900">Reset your password</h1>
      <p className="mb-8 text-sm text-gray-400">
        Enter your email and we&apos;ll send you a reset link.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-[#58111A]">
            Email address
          </label>
          <input
            type="email"
            placeholder="you@pharmacy.com"
            autoComplete="email"
            className={inputCls}
            {...register('email')}
          />
          {errors.email && (
            <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-xl py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          style={{ background: '#58111A', boxShadow: '0 4px 18px rgba(88,17,26,.35)' }}
        >
          {isPending ? 'Sending…' : 'Send reset link'}
        </button>
      </form>
    </div>
  )
}
