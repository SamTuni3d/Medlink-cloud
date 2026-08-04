'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { Eye, EyeOff } from 'lucide-react'
import { registerOrganization } from './actions'

type State = { error?: string } | null

const inputCls =
  'w-full border-0 border-b border-gray-200 bg-transparent px-0 py-2 text-sm text-gray-900 placeholder:text-gray-300 focus:border-[#58111A] focus:outline-none focus:ring-0 transition-colors'

function passwordStrength(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: '', color: '' }
  let score = 0
  if (pw.length >= 8)           score++
  if (pw.length >= 12)          score++
  if (/[A-Z]/.test(pw))        score++
  if (/[0-9]/.test(pw))        score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  if (score <= 1) return { score, label: 'Weak',   color: '#ef4444' }
  if (score <= 2) return { score, label: 'Fair',   color: '#f97316' }
  if (score <= 3) return { score, label: 'Good',   color: '#eab308' }
  return              { score, label: 'Strong', color: '#22c55e' }
}

function PasswordInput({
  id, name, placeholder, autoComplete, value, onChange, required,
}: {
  id: string; name: string; placeholder?: string; autoComplete?: string
  value: string; onChange: (v: string) => void; required?: boolean
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input
        id={id} name={name}
        type={show ? 'text' : 'password'}
        placeholder={placeholder}
        autoComplete={autoComplete}
        value={value}
        onChange={e => onChange(e.target.value)}
        required={required}
        className={inputCls + ' pr-8'}
      />
      <button
        type="button"
        onClick={() => setShow(v => !v)}
        tabIndex={-1}
        className="absolute right-0 top-1/2 -translate-y-1/2 text-gray-300 transition-colors hover:text-gray-500"
        aria-label={show ? 'Hide password' : 'Show password'}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  )
}

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

export default function RegisterPage() {
  const [password,  setPassword]  = useState('')
  const [confirmPw, setConfirmPw] = useState('')

  const [state, formAction, isPending] = useActionState<State, FormData>(
    async (_prev, formData) => {
      const pw      = formData.get('password') as string
      const confirm = formData.get('confirmPassword') as string
      if (pw.length < 8)  return { error: 'Password must be at least 8 characters.' }
      if (pw !== confirm) return { error: 'Passwords do not match.' }
      return registerOrganization(formData)
    },
    null,
  )

  const strength = passwordStrength(password)

  return (
    <div>
      {/* Tab switcher */}
      <div className="mb-7 flex gap-7 border-b border-gray-100">
        <span className="relative pb-2.5 text-base font-bold text-gray-900 after:absolute after:inset-x-0 after:-bottom-px after:h-[2.5px] after:rounded-full after:bg-[#58111A]">
          Sign Up
        </span>
        <Link
          href="/login"
          className="pb-2.5 text-base font-semibold text-gray-400 transition-colors hover:text-gray-600"
        >
          Sign In
        </Link>
      </div>

      <p className="mb-5 text-sm text-gray-400">
        Join MedLink and simplify your pharmacy management
      </p>

      <form action={formAction} className="space-y-4">
        <div>
          <label htmlFor="organizationName" className="mb-1.5 block text-xs font-semibold text-[#58111A]">
            Pharmacy Name
          </label>
          <input
            id="organizationName" name="organizationName"
            type="text"
            placeholder="Accra Central Pharmacy"
            required minLength={2}
            className={inputCls}
          />
        </div>

        <div>
          <label htmlFor="fullName" className="mb-1.5 block text-xs font-semibold text-[#58111A]">
            Full Name
          </label>
          <input
            id="fullName" name="fullName"
            type="text"
            placeholder="Kofi Mensah"
            autoComplete="name"
            required minLength={2}
            className={inputCls}
          />
        </div>

        <div>
          <label htmlFor="email" className="mb-1.5 block text-xs font-semibold text-[#58111A]">
            Email
          </label>
          <input
            id="email" name="email"
            type="email"
            placeholder="kofi@pharmacyname.com"
            autoComplete="email"
            required
            className={inputCls}
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-1.5 block text-xs font-semibold text-[#58111A]">
            Password
          </label>
          <PasswordInput
            id="password" name="password"
            autoComplete="new-password"
            value={password} onChange={setPassword}
            required
          />
          {password.length > 0 && (
            <div className="mt-2 space-y-1">
              <div className="flex gap-1">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-[3px] flex-1 rounded-full transition-all duration-300"
                    style={{ background: i < strength.score ? strength.color : '#e5e7eb' }}
                  />
                ))}
              </div>
              {strength.label && (
                <p className="text-xs font-semibold" style={{ color: strength.color }}>
                  {strength.label}
                </p>
              )}
            </div>
          )}
        </div>

        <div>
          <label htmlFor="confirmPassword" className="mb-1.5 block text-xs font-semibold text-[#58111A]">
            Confirm Password
          </label>
          <PasswordInput
            id="confirmPassword" name="confirmPassword"
            autoComplete="new-password"
            value={confirmPw} onChange={setConfirmPw}
            required
          />
          {confirmPw.length > 0 && (
            <p className={`mt-1 text-xs font-medium ${password === confirmPw ? 'text-green-600' : 'text-red-500'}`}>
              {password === confirmPw ? 'Passwords match ✓' : 'Passwords do not match'}
            </p>
          )}
        </div>

        <div className="flex items-start gap-2 pt-1">
          <input
            type="checkbox" id="terms" required
            className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 cursor-pointer accent-[#58111A]"
          />
          <label htmlFor="terms" className="cursor-pointer text-xs leading-relaxed text-gray-400">
            I agree to the{' '}
            <span className="font-semibold text-[#58111A]">Terms of Service</span>
            {' '}and{' '}
            <span className="font-semibold text-[#58111A]">Privacy Policy</span>
          </label>
        </div>

        {state?.error && (
          <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
            {state.error}
          </div>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="mt-2 w-full rounded-xl py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          style={{ background: '#58111A', boxShadow: '0 4px 18px rgba(88,17,26,.35)' }}
        >
          {isPending ? 'Creating account…' : 'Sign Up'}
        </button>
      </form>

      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-gray-100" />
        <span className="text-xs font-semibold text-gray-400">or</span>
        <div className="h-px flex-1 bg-gray-100" />
      </div>

      <div className="flex flex-col gap-2.5">
        <SocialButton icon={<GoogleIcon />} label="Sign up with Google" />
        <SocialButton icon={<AppleIcon />}  label="Sign up with Apple"  />
      </div>

      <p className="mt-6 text-center text-sm text-gray-400">
        Already have an account?{' '}
        <Link href="/login" className="font-bold text-[#58111A] hover:opacity-80">
          Sign In
        </Link>
      </p>
    </div>
  )
}
