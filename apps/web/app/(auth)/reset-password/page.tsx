'use client'

import { useTransition, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const schema = z
  .object({
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Must include an uppercase letter')
      .regex(/[0-9]/, 'Must include a number'),
    confirmPassword: z.string(),
  })
  .refine(d => d.password === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  })

type FormValues = z.infer<typeof schema>

const inputCls =
  'w-full border-0 border-b border-gray-200 bg-transparent px-0 py-2 text-sm text-gray-900 placeholder:text-gray-300 focus:border-[#58111A] focus:outline-none focus:ring-0 transition-colors'

export default function ResetPasswordPage() {
  const [isPending, startTransition] = useTransition()
  const [done, setDone]             = useState(false)
  const [showPw, setShowPw]         = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const router = useRouter()

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirmPassword: '' },
  })

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password: values.password })
      if (error) {
        const msg = error.message.toLowerCase()
        if (msg.includes('same password') || msg.includes('different password')) {
          setError('password', { message: 'New password must be different from your old one.' })
        } else {
          setError('root', { message: 'Failed to update password. The reset link may have expired.' })
        }
      } else {
        setDone(true)
        setTimeout(() => router.push('/dashboard'), 3000)
      }
    })
  }

  if (done) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-green-50">
          <CheckCircle2 className="h-7 w-7 text-green-600" />
        </div>
        <h1 className="text-xl font-bold text-gray-900">Password updated</h1>
        <p className="mt-2 text-sm text-gray-500">
          Your password has been changed successfully.
        </p>
        <p className="mt-1 text-xs text-gray-400">Redirecting you to the dashboard…</p>
        <Link
          href="/dashboard"
          className="mt-5 inline-block text-sm font-semibold text-[#58111A] hover:opacity-80"
        >
          Go to dashboard now
        </Link>
      </div>
    )
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-gray-900">Set new password</h1>
      <p className="mb-8 text-sm text-gray-400">
        Choose a strong password for your account
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* New password */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-[#58111A]">
            New password
          </label>
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              placeholder="Min. 8 characters"
              autoComplete="new-password"
              className={inputCls + ' pr-8'}
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
          <p className="mt-1 text-xs text-gray-400">
            Min. 8 characters, one uppercase letter, one number
          </p>
          {errors.password && (
            <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>
          )}
        </div>

        {/* Confirm password */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-[#58111A]">
            Confirm new password
          </label>
          <div className="relative">
            <input
              type={showConfirm ? 'text' : 'password'}
              placeholder="Re-enter your password"
              autoComplete="new-password"
              className={inputCls + ' pr-8'}
              {...register('confirmPassword')}
            />
            <button
              type="button"
              onClick={() => setShowConfirm(v => !v)}
              tabIndex={-1}
              className="absolute right-0 top-1/2 -translate-y-1/2 text-gray-300 transition-colors hover:text-gray-500"
              aria-label={showConfirm ? 'Hide password' : 'Show password'}
            >
              {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.confirmPassword && (
            <p className="mt-1 text-xs text-red-500">{errors.confirmPassword.message}</p>
          )}
        </div>

        {errors.root && (
          <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
            {errors.root.message}{' '}
            <Link href="/forgot-password" className="underline">
              Request a new link.
            </Link>
          </div>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-xl py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          style={{ background: '#58111A', boxShadow: '0 4px 18px rgba(88,17,26,.35)' }}
        >
          {isPending ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </div>
  )
}
