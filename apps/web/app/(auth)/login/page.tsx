'use client'

import { Suspense, useTransition, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff } from 'lucide-react'
import { signIn } from './actions'

const schema = z.object({
  email:    z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})
type FormValues = z.infer<typeof schema>

const inputCls =
  'w-full border-0 border-b border-gray-200 bg-transparent px-0 py-2 text-sm text-gray-900 placeholder:text-gray-300 focus:border-[#58111A] focus:outline-none focus:ring-0 transition-colors'

function SocialButton({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
    >
      {icon}
      {label}
    </button>
  )
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" className="text-gray-800">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
    </svg>
  )
}

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
    <div>
      {/* Tab switcher */}
      <div className="mb-7 flex gap-7 border-b border-gray-100">
        <Link
          href="/register"
          className="pb-2.5 text-base font-semibold text-gray-400 transition-colors hover:text-gray-600"
        >
          Sign Up
        </Link>
        <span className="relative pb-2.5 text-base font-bold text-gray-900 after:absolute after:inset-x-0 after:-bottom-px after:h-[2.5px] after:rounded-full after:bg-[#58111A]">
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
          <label className="mb-1.5 block text-xs font-semibold text-[#58111A]">E-mail</label>
          <input
            type="email"
            placeholder="Enter your email"
            autoComplete="email"
            className={inputCls}
            {...register('email')}
          />
          {errors.email && (
            <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>
          )}
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-xs font-semibold text-[#58111A]">Password</label>
            <Link
              href="/forgot-password"
              className="text-xs font-semibold text-[#58111A] hover:opacity-80"
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
          {errors.password && (
            <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="remember"
            className="h-3.5 w-3.5 cursor-pointer accent-[#58111A]"
          />
          <label htmlFor="remember" className="cursor-pointer text-xs text-gray-400">
            Remember me
          </label>
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
          style={{ background: '#58111A', boxShadow: '0 4px 18px rgba(88,17,26,.35)' }}
        >
          {isPending ? 'Signing in…' : 'Login'}
        </button>
      </form>

      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-gray-100" />
        <span className="text-xs font-semibold text-gray-400">or</span>
        <div className="h-px flex-1 bg-gray-100" />
      </div>

      <div className="flex flex-col gap-2.5">
        <SocialButton icon={<GoogleIcon />} label="Sign in with Google" />
        <SocialButton icon={<AppleIcon />}  label="Sign in with Apple"  />
      </div>

      <p className="mt-6 text-center text-sm text-gray-400">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="font-bold text-[#58111A] hover:opacity-80">
          Sign Up
        </Link>
      </p>
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
